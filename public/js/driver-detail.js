document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const driverId = params.get("id");

  if (!driverId) {
    window.location.href = "/index.html";
    return;
  }

  const modal = new bootstrap.Modal(document.getElementById("verifyModal"));

  let currentUser = null;
  let fetchedBusinessData = null;

  // Get current user info
  try {
    currentUser = await api.get("/auth/me");
  } catch (error) {
    console.error("Failed to get user info:", error);
  }

  // Initial Skeleton State
  showSkeletons();

  try {
    const driver = await api.get(`/drivers/${driverId}`);
    const bonuses = await api.get(`/bonuses/driver/${driverId}`);
    renderDriver(driver, bonuses, currentUser);
    loadPaymentHistory(driverId);

    // Load Debt Info
    loadDebts(driverId);

    // Show Add Debt button for admins
    if (currentUser && currentUser.role === "admin") {
      document.getElementById("addDebtBtn").style.display = "block";
    }

    // Add Debt Logic
    const debtModal = new bootstrap.Modal(
      document.getElementById("addDebtModal")
    );
    const reasonSelect = document.getElementById("debtReasonInput");
    const otherContainer = document.getElementById("otherReasonContainer");

    document.getElementById("addDebtBtn").onclick = () => {
      document.getElementById("debtAmountInput").value = "";
      document.getElementById("debtNotesInput").value = "";
      document.getElementById("otherReasonInput").value = "";
      reasonSelect.value = "Insurance"; // Default
      otherContainer.classList.add("d-none");
      debtModal.show();
    };

    // Central Button Logic (Same as header button)
    document.getElementById("addDebtCentralBtn").onclick =
      document.getElementById("addDebtBtn").onclick;

    reasonSelect.addEventListener("change", (e) => {
      if (e.target.value === "Other") {
        otherContainer.classList.remove("d-none");
      } else {
        otherContainer.classList.add("d-none");
      }
    });

    document.getElementById("confirmAddDebtBtn").onclick = async () => {
      const amount = document.getElementById("debtAmountInput").value;
      let reason = reasonSelect.value;
      const notes = document.getElementById("debtNotesInput").value;

      // Custom Reason Validation
      if (reason === "Other") {
        const customReason = document
          .getElementById("otherReasonInput")
          .value.trim();
        if (!customReason) {
          ui.toast("Please specify a reason", "error");
          return;
        }
        reason = customReason;
      }

      if (!amount || amount <= 0) {
        ui.toast("Please enter a valid amount", "error");
        return;
      }

      try {
        document.getElementById("confirmAddDebtBtn").disabled = true;
        await api.post("/debts", {
          driverId,
          amount,
          reason,
          notes,
        });

        ui.toast("Debt created successfully", "success");
        debtModal.hide();
        loadDebts(driverId);
        // Reload bonuses to reflect any retroactive deductions
        const updatedBonuses = await api.get(`/bonuses/driver/${driverId}`);
        renderBonusList(updatedBonuses);
        updateTotalCalculations(updatedBonuses); // Helper needed or inline update
      } catch (error) {
        console.error(error);
        ui.toast(error.message || "Failed to create debt", "error");
      } finally {
        document.getElementById("confirmAddDebtBtn").disabled = false;
      }
    };
  } catch (error) {
    ui.toast("Failed to load driver details", "error");
    console.error(error);
  }

  // Mark as Verified Modal Logic
  document.getElementById("markVerifiedBtn").onclick = () => {
    document.getElementById("modalDriverName").textContent =
      document.getElementById("driverName").textContent;
    document.getElementById("modalTotalBonus").textContent =
      document.getElementById("totalBonus").textContent;
    document.getElementById("verificationDate").valueAsDate = new Date();

    // Reset modal state
    document.getElementById("tinInput").value = "";
    document.getElementById("businessDataSection").classList.add("d-none");
    document.getElementById("confirmVerifyBtn").disabled = true;
    fetchedBusinessData = null;

    // Show admin override section if user is admin
    if (currentUser && currentUser.role === "admin") {
      document
        .getElementById("adminOverrideSection")
        .classList.remove("d-none");
    } else {
      document.getElementById("adminOverrideSection").classList.add("d-none");
    }

    modal.show();
  };

  // TIN Lookup Button
  document.getElementById("lookupTINBtn").onclick = async () => {
    const tin = document.getElementById("tinInput").value.trim();

    if (!tin) {
      ui.toast("Please enter a TIN", "error");
      return;
    }

    const btn = document.getElementById("lookupTINBtn");
    const originalHTML = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span> Looking up...';

      const response = await api.get(`/drivers/tin/${tin}`);

      if (response.success && response.data) {
        fetchedBusinessData = response.data;
        displayBusinessData(response.data);
        ui.toast("Business data fetched successfully!", "success");
      } else {
        throw new Error("No business data found");
      }
    } catch (error) {
      ui.toast(error.message || "Failed to lookup TIN", "error");
      document.getElementById("businessDataSection").classList.add("d-none");
      fetchedBusinessData = null;
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  };

  // Display fetched business data
  function displayBusinessData(data) {
    // Display all business information
    document.getElementById("businessNameDisplay").textContent =
      data.businessName || "N/A";
    document.getElementById("modalTinDisplay").textContent = data.tin || "N/A";
    document.getElementById("licenceNumberDisplay").textContent =
      data.licenceNumber || "N/A";
    document.getElementById("managerNameDisplay").textContent =
      data.managerName || "N/A";
    document.getElementById("regNoDisplay").textContent = data.regNo || "N/A";

    // Format and display registration date
    if (data.regDate) {
      const regDate = new Date(data.regDate);
      document.getElementById("regDateDisplay").textContent =
        regDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
    } else {
      document.getElementById("regDateDisplay").textContent = "N/A";
    }

    // Display manager photo if available
    const photoContainer = document.getElementById("managerPhotoContainer");
    const photoImg = document.getElementById("managerPhoto");

    if (data.managerPhoto && data.managerPhoto.trim() !== "") {
      // Handle both full URLs and base64 encoded images
      if (
        data.managerPhoto.startsWith("http") ||
        data.managerPhoto.startsWith("data:image") ||
        data.managerPhoto.startsWith("/uploads")
      ) {
        photoImg.src = data.managerPhoto;
      } else {
        // Assume it's a base64 string without the data URI prefix
        photoImg.src = `data:image/jpeg;base64,${data.managerPhoto}`;
      }
      photoImg.style.display = "block";
    } else {
      // Show placeholder or hide photo
      photoImg.src =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%23ddd" width="150" height="150"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="18"%3ENo Photo%3C/text%3E%3C/svg%3E';
      photoImg.style.display = "block";
    }

    document.getElementById("businessDataSection").classList.remove("d-none");
    // Hide Admin Override if we have actual TIN data
    document.getElementById("adminOverrideSection").classList.add("d-none");

    // Reset checkboxes
    document.getElementById("confirmDataCheck").checked = false;
    document.getElementById("driverLicenseCheck").checked = false;
    document.getElementById("libreraCheck").checked = false;

    updateVerifyButtonState();
  }

  // Update verify button state based on conditions
  function updateVerifyButtonState() {
    const confirmCheck = document.getElementById("confirmDataCheck").checked;
    const driverLicenseCheck =
      document.getElementById("driverLicenseCheck")?.checked || false;
    const libreraCheck =
      document.getElementById("libreraCheck")?.checked || false;
    const adminOverride =
      document.getElementById("adminOverrideCheck")?.checked || false;
    const hasBusinessData = fetchedBusinessData !== null;

    // Enable button if:
    // 1. Business data is fetched AND user confirmed AND both documents checked, OR
    // 2. Admin override is checked
    const allDocumentsChecked = driverLicenseCheck && libreraCheck;
    const shouldEnable =
      (hasBusinessData && confirmCheck && allDocumentsChecked) || adminOverride;
    document.getElementById("confirmVerifyBtn").disabled = !shouldEnable;
  }

  // Listen to checkbox changes
  document
    .getElementById("confirmDataCheck")
    ?.addEventListener("change", updateVerifyButtonState);
  document
    .getElementById("driverLicenseCheck")
    ?.addEventListener("change", updateVerifyButtonState);
  document
    .getElementById("libreraCheck")
    ?.addEventListener("change", updateVerifyButtonState);

  document
    .getElementById("adminOverrideCheck")
    ?.addEventListener("change", (e) => {
      const tinInputSection = document.getElementById("tinInputSection");
      if (e.target.checked) {
        tinInputSection.classList.add("d-none");
        // Clear TIN input if override is selected
        document.getElementById("tinInput").value = "";
      } else {
        tinInputSection.classList.remove("d-none");
      }
      updateVerifyButtonState();
    });

  // Reset modal state when opened
  document.getElementById("markVerifiedBtn").addEventListener("click", () => {
    // Check if user is admin
    const user = auth.getUser();
    const isAdmin = user && user.role === "admin";

    // Reset business data section
    document.getElementById("businessDataSection").classList.add("d-none");
    fetchedBusinessData = null;

    // Reset visibility of input sections
    document.getElementById("tinInputSection").classList.remove("d-none");

    const overrideSection = document.getElementById("adminOverrideSection");
    if (isAdmin) {
      overrideSection.classList.remove("d-none");
    } else {
      overrideSection.classList.add("d-none");
    }

    // Clear inputs
    document.getElementById("tinInput").value = "";
    document.getElementById("adminOverrideCheck").checked = false;

    // Reset checkboxes
    document.getElementById("confirmDataCheck").checked = false;
    document.getElementById("driverLicenseCheck").checked = false;
    document.getElementById("libreraCheck").checked = false;

    updateVerifyButtonState();
  });

  // Confirm Verification Button
  document.getElementById("confirmVerifyBtn").onclick = async () => {
    const date = document.getElementById("verificationDate").value;
    const adminOverride =
      document.getElementById("adminOverrideCheck")?.checked || false;

    if (!adminOverride && !fetchedBusinessData) {
      ui.toast("Please lookup TIN first", "error");
      return;
    }

    const btn = document.getElementById("confirmVerifyBtn");
    try {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span> Verifying...';

      const payload = {
        verified_date: date,
        admin_override: adminOverride,
      };

      // Add TIN data if available
      if (fetchedBusinessData) {
        payload.tin = fetchedBusinessData.tin;
        payload.business_name = fetchedBusinessData.businessName;
        payload.licence_number = fetchedBusinessData.licenceNumber;
        payload.manager_name = fetchedBusinessData.managerName;
        payload.manager_photo = fetchedBusinessData.managerPhoto;
      }

      await api.put(`/drivers/${driverId}/verify`, payload);

      ui.toast("Driver verified successfully!", "success");
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      modal.hide();
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      ui.toast(error.message || "Verification failed", "error");
      btn.disabled = false;
      btn.textContent = "Confirm Verification";
    }
  };
});

async function loadDebts(driverId) {
  try {
    const response = await api.get(`/debts/driver/${driverId}`);
    const { debts, deductions } = response;

    // 1. Calculate Total Active Debt
    const totalActive = debts
      .filter((d) => d.status === "active")
      .reduce((sum, d) => sum + parseFloat(d.remaining_amount), 0);

    document.getElementById(
      "totalActiveDebt"
    ).textContent = `${totalActive.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ETB`;

    // 2. Render Table (Combine debts creation and deductions history?)
    // Let's show a mixed timeline or just the debt list.
    // User requested "view debt/deduction history".
    // Let's modify the table to show "Transaction History"
    const tbody = document.getElementById("debtTableBody");
    tbody.innerHTML = "";

    // UI Elements
    const dataRow = document.getElementById("debtDataRow");
    const emptyState = document.getElementById("debtEmptyState");
    const headerBtn = document.getElementById("addDebtBtn");
    const centralBtn = document.getElementById("addDebtCentralBtn");

    // Get current user for permission check
    const user = auth.getUser();
    const isAdmin = user && user.role === "admin";

    if (debts.length === 0 && deductions.length === 0) {
      // EMPTY STATE
      dataRow.classList.add("d-none");
      headerBtn.style.display = "none"; // Hide header button
      emptyState.classList.remove("d-none");

      // Show central button only for admins
      if (isAdmin) {
        centralBtn.style.display = "inline-block";
      } else {
        centralBtn.style.display = "none";
      }
      return;
    }

    // HAS DATA STATE
    dataRow.classList.remove("d-none");
    emptyState.classList.add("d-none");

    // HAS DATA STATE
    dataRow.classList.remove("d-none");
    emptyState.classList.add("d-none");

    // Show header button if admin
    if (isAdmin) {
      if (totalActive > 0) {
        // Enforce Single Active Debt Rules
        headerBtn.style.display = "block";
        headerBtn.disabled = true;
        headerBtn.innerHTML =
          '<i class="fas fa-lock me-2"></i> Active Debt Exists';
        headerBtn.title = "Clear existing debt before adding a new one";
      } else {
        headerBtn.style.display = "block";
        headerBtn.disabled = false;
        headerBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Add Debt';
        headerBtn.title = "";
      }
    } else {
      headerBtn.style.display = "none";
    }

    // Merge lists for timeline
    const timeline = [
      ...debts.map((d) => ({
        type: "DEBT_CREATED",
        date: d.created_at,
        amount: d.amount,
        ref: d.reason,
        status: d.status,
        original: d,
      })),
      ...deductions.map((d) => ({
        type: "DEDUCTION",
        date: d.created_at,
        amount: d.amount_deducted,
        ref: `Deducted from Bonus ${new Date(
          d.week_date
        ).toLocaleDateString()}`,
        status: "applied",
        original: d,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    timeline.forEach((item) => {
      const isDebt = item.type === "DEBT_CREATED";
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td class="small text-muted">${new Date(
                  item.date
                ).toLocaleDateString()}</td>
                <td><span class="badge ${
                  isDebt
                    ? "bg-secondary text-secondary"
                    : "bg-success text-success"
                } bg-opacity-10">${
        isDebt ? "New Debt" : "Deduction"
      }</span></td>
                <td class="small">${escapeHtml(item.ref)}</td>
                <td class="text-end fw-bold ${
                  isDebt ? "text-dark" : "text-success"
                }">${parseFloat(item.amount).toLocaleString()}</td>
                <td class="text-end text-muted small">${
                  isDebt
                    ? parseFloat(
                        item.original.remaining_amount
                      ).toLocaleString()
                    : "-"
                }</td>
                <td class="text-center"><span class="badge bg-light text-dark border">${
                  item.status
                }</span></td>
            `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load debts:", error);
  }
}

// XSS Protection Helper
function escapeHtml(text) {
  if (!text) return "";
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showSkeletons() {
  document.getElementById("bonusHistoryTableBody").innerHTML = `
        <tr><td colspan="6"><div class="skeleton skeleton-text w-100"></div></td></tr>
        <tr><td colspan="6"><div class="skeleton skeleton-text w-100"></div></td></tr>
        <tr><td colspan="6"><div class="skeleton skeleton-text w-100"></div></td></tr>
    `;
}

async function loadPaymentHistory(driverId) {
  const tbody = document.getElementById("paymentHistoryTableBody");
  try {
    const response = await api.get(`/payments/history?driver_id=${driverId}`);

    // Handle both old array format and new paginated object format
    const history = Array.isArray(response)
      ? response
      : response.payments || [];

    tbody.innerHTML = "";

    if (history.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center py-4 text-muted">No payment history found</td></tr>';
      return;
    }

    history.forEach((p) => {
      const tr = document.createElement("tr");
      // Global history now strictly contains 'paid' payments from backend
      const statusBadge =
        '<span class="badge bg-success bg-opacity-10 text-success">Paid</span>';

      tr.innerHTML = `
                <td class="px-4 py-3 align-middle">${new Date(
                  p.payment_date
                ).toLocaleDateString()}</td>
                <td class="px-4 py-3 align-middle fw-bold text-dark">${parseFloat(
                  p.total_amount
                ).toLocaleString()} ETB</td>
                <td class="px-4 py-3 align-middle text-muted text-capitalize">${(
                  p.payment_method || ""
                ).replace("_", " ")}</td>
                <td class="px-4 py-3 align-middle">${statusBadge}</td>
                <td class="px-4 py-3 align-middle text-muted small">${
                  p.notes || "-"
                }</td>
                <td class="px-4 py-3 align-middle text-muted small">${
                  p.processed_by_name || "System"
                }</td>
            `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load payment history:", error);
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load history</td></tr>';
  }
}

function renderDriver(driver, bonuses, currentUser) {
  document.getElementById("driverName").textContent = driver.full_name;
  document.getElementById("nameInitial").textContent =
    driver.full_name.charAt(0);
  document.getElementById("driverId").textContent = driver.driver_id;
  document.getElementById("driverPhone").textContent =
    driver.phone_number || "No phone";
  document.getElementById("createdAt").textContent = new Date(
    driver.created_at
  ).toLocaleDateString();

  const badge = document.getElementById("driverStatusBadge");
  badge.textContent = driver.verified ? "Verified" : "Unverified";
  badge.className = `badge-status ${
    driver.verified ? "badge-verified" : "badge-unverified"
  }`;

  if (driver.verified) {
    document.getElementById("markVerifiedBtn").classList.add("d-none");
    document
      .getElementById("verificationInfoSection")
      .classList.remove("d-none");
    document.getElementById("verifiedDateText").textContent = new Date(
      driver.verified_date
    ).toLocaleDateString();

    // Show who verified the driver
    if (driver.verified_by_name) {
      const verifierSpan = document.createElement("span");
      verifierSpan.className = "ms-2 text-muted small";
      verifierSpan.innerHTML = `by <strong>${driver.verified_by_name}</strong>`;
      // Check if already added to prevent duplicates
      const parent = document.getElementById("verifiedDateText").parentNode;
      if (!parent.querySelector(".ms-2.text-muted.small")) {
        parent.appendChild(verifierSpan);
      }
    }

    document.getElementById("summaryStatus").textContent =
      "Verified for Payment";

    // Display TIN information if available
    if (driver.tin) {
      document.getElementById("tinInfoSection").classList.remove("d-none");
      document.getElementById("infoTinDisplay").textContent = driver.tin;
      document.getElementById("businessNameInfo").textContent =
        driver.business_name || "N/A";
      document.getElementById("licenceNumberInfo").textContent =
        driver.licence_number || "N/A";
      document.getElementById("managerNameInfo").textContent =
        driver.manager_name || "N/A";

      if (driver.manager_photo) {
        const photoImg = document.getElementById("managerPhotoInfoImg");
        // Fix: Ensure base64 gets prefix if it's not present
        if (
          driver.manager_photo.startsWith("http") ||
          driver.manager_photo.startsWith("data:image") ||
          driver.manager_photo.startsWith("/uploads")
        ) {
          photoImg.src = driver.manager_photo;
        } else {
          photoImg.src = `data:image/jpeg;base64,${driver.manager_photo}`;
        }
        document.getElementById("managerPhotoInfo").style.display = "block";
      }
    }
  }

  /* Total Calculations */
  const total = bonuses.reduce(
    (sum, b) => sum + parseFloat(b.net_payout || 0),
    0
  );
  const totalGross = bonuses.reduce(
    (sum, b) => sum + parseFloat(b.gross_payout || b.net_payout / 0.97),
    0
  );
  const totalWithholding = bonuses.reduce(
    (sum, b) => sum + parseFloat(b.withholding_tax || 0),
    0
  );

  document.getElementById("totalBonus").textContent = `${total.toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )} ETB`;

  // Update Reference Fields
  document.getElementById(
    "totalGross"
  ).textContent = `${totalGross.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
  document.getElementById(
    "totalWithholding"
  ).textContent = `${totalWithholding.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;

  document.getElementById("weeksCount").textContent = bonuses.length;

  if (bonuses.length > 0) {
    const dates = bonuses
      .map((b) => new Date(b.week_date))
      .sort((a, b) => a - b);
    document.getElementById(
      "bonusPeriod"
    ).textContent = `${dates[0].toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${dates[dates.length - 1].toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;

    renderBonusList(bonuses);
  } else {
    document.getElementById("bonusHistoryTableBody").innerHTML =
      '<tr><td colspan="6" class="text-center py-5 text-muted">No bonus records found</td></tr>';
  }
}

function renderBonusList(bonuses) {
  const tbody = document.getElementById("bonusHistoryTableBody");
  tbody.innerHTML = "";

  bonuses
    .sort((a, b) => new Date(b.week_date) - new Date(a.week_date))
    .forEach((b) => {
      const tr = document.createElement("tr");

      let statusHtml =
        '<span class="badge bg-warning bg-opacity-10 text-warning rounded-pill px-2">Pending</span>';
      if (b.payment_id) {
        if (b.payment_status === "paid") {
          statusHtml =
            '<span class="badge bg-success bg-opacity-10 text-success rounded-pill px-2">Paid</span>';
        } else if (b.payment_status === "processing") {
          statusHtml =
            '<span class="badge bg-info bg-opacity-10 text-info rounded-pill px-2">Processing</span>';
        }
      }

      tr.innerHTML = `
            <td class="ps-4 align-middle">
                ${new Date(b.week_date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
            </td>
            <td class="text-muted small align-middle">${
              b.file_name || "Manual Import"
            }</td>
            <td class="align-middle">
                ${statusHtml}
            </td>
            <td class="text-muted align-middle">${parseFloat(
              b.gross_payout || 0
            ).toLocaleString()}</td>
            <td class="text-muted align-middle">${parseFloat(
              b.withholding_tax || 0
            ).toLocaleString()}</td>
            <td class="text-end pe-4 fw-bold text-dark align-middle">
                ${parseFloat(
                  b.final_payout !== null ? b.final_payout : b.net_payout
                ).toLocaleString()} ETB
                ${
                  b.final_payout !== null && b.final_payout < b.net_payout
                    ? `<i class="fas fa-info-circle text-danger ms-1" data-bs-toggle="tooltip" title="Original: ${parseFloat(
                        b.net_payout
                      ).toLocaleString()} (Debt Deducted)"></i>`
                    : ""
                }
            </td>
        `;
      tbody.appendChild(tr);
    });
}

function updateTotalCalculations(bonuses) {
  /* Total Calculations */
  const total = bonuses.reduce(
    (sum, b) =>
      sum +
      parseFloat(b.final_payout !== null ? b.final_payout : b.net_payout || 0),
    0
  );
  document.getElementById("totalBonus").textContent = `${total.toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )} ETB`;

  // Re-render period
  if (bonuses.length > 0) {
    document.getElementById("weeksCount").textContent = bonuses.length;
  }
}
