document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const driverId = params.get("id");

  if (!driverId) {
    window.location.href = "/";
    return;
  }

  const modal = new bootstrap.Modal(document.getElementById("verifyModal"));

  let currentUser = null;
  let fetchedBusinessData = null;
  let driver = null; // Declare at top level for accessibility

  // Get current user info
  try {
    currentUser = await api.get("/auth/me");
  } catch (error) {
    console.error("Failed to get user info:", error);
  }

  // Initial Skeleton State
  showSkeletons();

  try {
    driver = await api.get(`/drivers/${driverId}`);
    const bonuses = await api.get(`/bonuses/driver/${driverId}`);
    renderDriver(driver, bonuses, currentUser);
    if (window.renderPhoneHistory) {
      window.renderPhoneHistory(driver, currentUser);
    }
    loadPaymentHistory(driverId);

    // Load Debt Info
    loadDebts(driverId);

    // Show Add Debt button for admins and directors
    if (currentUser && ["admin", "director"].includes(currentUser.role)) {
      document.getElementById("addDebtBtn").style.display = "block";
    }

    // Show Action Dropdown for all (for statements), but hide Block Option for non-admins
    const adminActionsDropdown = document.getElementById(
      "adminActionsDropdown",
    );
    adminActionsDropdown.classList.remove("d-none");

    // Dynamic Dropdown Name
    if (currentUser.role !== "admin") {
      const dropdownBtn =
        adminActionsDropdown.querySelector(".dropdown-toggle");
      if (dropdownBtn) {
        dropdownBtn.innerHTML = '<i class="fas fa-file-alt me-2"></i> Actions';
      }
    }

    const canBlock = ["admin", "director", "manager"].includes(
      currentUser.role,
    );
    if (!canBlock) {
      const blockBtn = document.getElementById("blockDriverBtn");
      if (blockBtn) {
        // Hide the list item containing the button
        blockBtn.closest("li").style.display = "none";

        // Optional: Try to hide the header and divider for cleaner UI
        // This assumes specific DOM structure (Header -> Button -> Divider)
        // If strictly following user request, just hiding button is critical.
        // Let's try to hide the previous header too if we can select it easily, otherwise leave it.
        // Simple approach: Just hide the button LI.
      }
    }

    // New Verify Button Logic: Reveal only if allowed
    const verifyBtn = document.getElementById("markVerifiedBtn");
    if (!driver.verified && currentUser && currentUser.role !== "auditor") {
      verifyBtn.classList.remove("d-none");
    }

    // Export Statement Logic
    // Export Statement Logic (Separate Types)
    document.querySelectorAll(".export-statement-btn").forEach((btn) => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const type = e.currentTarget.dataset.type; // 'debt', 'payment', 'bonus'

        try {
          ui.showLoading(true);
          const token = localStorage.getItem("token");
          const response = await fetch(
            `${api.baseURL}/drivers/${driverId}/statement?type=${type}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (!response.ok) throw new Error("Failed to generate statement");

          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/pdf")) {
            const errorText = await response.text();
            console.error("Statement Export Error:", errorText);
            throw new Error("Invalid file received. Please try again.");
          }

          const blob = await response.blob();

          // 1. Hide the loader IMMEDIATELY
          ui.showLoading(false);

          // 2. Wrap the download trigger in a tiny timeout.
          // This allows the browser to "repaint" (hide the spinner)
          // before the OS download dialog blocks the UI thread.
          setTimeout(() => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${type.toUpperCase()}_Statement_${driverId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            // Clean up the URL object after some time
            setTimeout(() => window.URL.revokeObjectURL(url), 100);

            ui.toast(`${type} statement exported successfully`, "success");
          }, 200);
        } catch (error) {
          ui.showLoading(false);
          console.error(error);
          ui.toast("Failed to export statement", "error");
        }
      };
    });

    // Block/Unblock Logic
    const blockBtn = document.getElementById("blockDriverBtn");

    // Set initial text based on driver state
    if (driver.is_blocked) {
      blockBtn.innerHTML = '<i class="fas fa-unlock me-2"></i> Unblock Driver';
      blockBtn.classList.remove("text-danger");
      blockBtn.classList.add("text-success");
    }

    blockBtn.onclick = async (e) => {
      e.preventDefault();
      const isBlocked = driver.is_blocked; // Current state
      const action = isBlocked ? "Unblock" : "Block";

      if (confirm(`Are you sure you want to ${action} this driver?`)) {
        try {
          await api.put(`/drivers/${driverId}/block`, {
            is_blocked: !isBlocked,
            reason: "Admin Action",
          });

          ui.toast(`Driver ${action}ed successfully`, "success");
          setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
          ui.toast(error.message, "error");
        }
      }
    };

    // Add Debt Logic
    const debtModal = new bootstrap.Modal(
      document.getElementById("addDebtModal"),
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

  // Mark as Verified Modal Logic - Unified Handler
  document.getElementById("markVerifiedBtn").onclick = () => {
    // 1. Get current user and permissions
    if (!currentUser) {
      console.error("User not authenticated");
      return;
    }
    const user = currentUser;
    // Admin Override (Verify without TIN): Admin, Director, Manager
    const canOverride = ["admin", "director", "manager"].includes(user.role);
    // Partial Payout: Admin & Director
    const canPartialPayout = ["admin", "director"].includes(user.role);

    // 2. Update Modal Content
    document.getElementById("modalDriverName").textContent =
      document.getElementById("driverName").textContent;
    document.getElementById("modalTotalBonus").textContent =
      document.getElementById("totalBonus").textContent;
    document.getElementById("verificationDate").valueAsDate = new Date();

    // 3. Reset Inputs & State
    document.getElementById("tinInput").value = "";
    document.getElementById("businessDataSection").classList.add("d-none");
    document.getElementById("tinInputSection").classList.remove("d-none");
    document.getElementById("confirmVerifyBtn").disabled = true;

    // Reset checkboxes
    document.getElementById("confirmDataCheck").checked = false;
    document.getElementById("driverLicenseCheck").checked = false;
    document.getElementById("libreraCheck").checked = false;
    document.getElementById("ownershipPersonalCheck").checked = false;

    fetchedBusinessData = null;



    // 5. Handle Partial Payout Visibility
    const partialPaymentBtn = document.getElementById("partialPayoutBtn");
    if (canPartialPayout && !driver.verified) {
      partialPaymentBtn.classList.remove("d-none");
    } else {
      partialPaymentBtn.classList.add("d-none");
    }

    updateVerifyButtonState();
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
        data.managerPhoto.startsWith("/imports")
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
    const hasBusinessData = fetchedBusinessData !== null;

    // Enable button if:
    // 1. Business data is fetched AND user confirmed AND both documents checked
    const allDocumentsChecked = driverLicenseCheck && libreraCheck;
    const shouldEnable = hasBusinessData && confirmCheck && allDocumentsChecked;
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

  // Initialize default state
  document.getElementById('ownershipPersonalCheck').checked = false;

  // Confirm Verification Button
  document.getElementById("confirmVerifyBtn").onclick = async () => {
    const date = document.getElementById("verificationDate").value;
    const isPersonal = document.getElementById("ownershipPersonalCheck").checked;
    const tinOwnership = isPersonal ? 'Personal' : 'Other';

    if (!fetchedBusinessData) {
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
        tin_ownership: tinOwnership,
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

  // Partial Payout Button
  const passwordModal = new bootstrap.Modal(
    document.getElementById("passwordConfirmModal"),
  );

  document.getElementById("partialPayoutBtn").onclick = () => {
    // Clear password field
    document.getElementById("confirmPassword").value = "";
    // Hide verification modal and show password modal
    modal.hide();
    passwordModal.show();
  };

  document.getElementById("confirmPasswordBtn").onclick = async () => {
    const password = document.getElementById("confirmPassword").value;

    if (!password) {
      ui.toast("Password is required", "error");
      return;
    }

    const btn = document.getElementById("confirmPasswordBtn");
    const originalHTML = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span> Processing...';

      await api.post(`/drivers/${driverId}/payout-unverified`, { password });

      ui.toast(
        "Partial payout released successfully! Driver can now be paid 70% of their bonuses.",
        "success",
      );
      passwordModal.hide();
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      ui.toast(error.message || "Failed to release payout", "error");
      btn.disabled = false;
      btn.innerHTML = originalHTML;
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

    document.getElementById("totalActiveDebt").textContent =
      `${totalActive.toLocaleString(undefined, {
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
    const canAddDebt = user && ["admin", "director"].includes(user.role);

    if (debts.length === 0 && deductions.length === 0) {
      // EMPTY STATE
      dataRow.classList.add("d-none");
      headerBtn.style.display = "none"; // Hide header button
      emptyState.classList.remove("d-none");

      // Show central button only for authorized roles
      if (canAddDebt) {
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

    // Show header button if authorized
    if (canAddDebt) {
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

    // Separate penalties from regular debts
    const penalties = debts.filter((d) => d.reason === "Verification Penalty");
    const regularDebts = debts.filter(
      (d) => d.reason !== "Verification Penalty",
    );

    // Calculate total for regular debts only (penalties are already paid)
    const totalRegularActive = regularDebts
      .filter((d) => d.status === "active")
      .reduce((sum, d) => sum + parseFloat(d.remaining_amount), 0);

    // Merge lists for timeline - Regular Debts
    const regularTimeline = [
      ...regularDebts.map((d) => ({
        type: "DEBT_CREATED",
        date: d.created_at,
        amount: d.amount,
        ref: d.reason,
        status: d.status,
        original: d,
        isPenalty: false,
      })),
      ...deductions
        .filter((d) => {
          // Only include deductions that are NOT for penalties
          return !debts.some(
            (debt) =>
              debt.id === d.debt_id && debt.reason === "Verification Penalty",
          );
        })
        .map((d) => ({
          type: "DEDUCTION",
          date: d.created_at,
          amount: d.amount_deducted,
          ref: `Deducted from Bonus ${new Date(
            d.week_date,
          ).toLocaleDateString()}`,
          status: "applied",
          original: d,
          isPenalty: false,
        })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Penalty timeline
    const penaltyTimeline = penalties
      .map((d) => ({
        type: "PENALTY",
        date: d.created_at,
        amount: d.amount,
        ref: "30% deduction for unverified payout",
        status: d.status,
        original: d,
        isPenalty: true,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Render Regular Debts
    if (regularTimeline.length > 0) {
      regularTimeline.forEach((item) => {
        const isDebt = item.type === "DEBT_CREATED";
        const tr = document.createElement("tr");
        tr.innerHTML = `
                  <td class="small text-muted">${new Date(
                    item.date,
                  ).toLocaleDateString()}</td>
                  <td><span class="badge ${
                    isDebt ? "bg-danger text-danger" : "bg-success text-success"
                  } bg-opacity-10">${
                    isDebt ? " New Debt" : " Deduction"
                  }</span></td>
                  <td class="small">${escapeHtml(item.ref)}</td>
                  <td class="text-end fw-bold ${
                    isDebt ? "text-danger" : "text-success"
                  }">${parseFloat(item.amount).toLocaleString()}</td>
                  <td class="text-end text-muted small">${
                    isDebt
                      ? parseFloat(
                          item.original.remaining_amount,
                        ).toLocaleString()
                      : "-"
                  }</td>
                  <td class="text-center"><span class="badge bg-light text-dark border">${
                    item.status
                  }</span></td>
              `;
        tbody.appendChild(tr);
      });
    }

    // Render Penalties (if any) - different section
    const penaltySection = document.getElementById("penaltySection");
    const penaltyTableBody = document.getElementById("penaltyTableBody");

    if (penaltyTimeline.length > 0) {
      penaltySection.classList.remove("d-none");
      penaltyTableBody.innerHTML = "";

      penaltyTimeline.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                  <td class="small text-muted">${new Date(
                    item.date,
                  ).toLocaleDateString()}</td>
                  <td><span class="badge bg-secondary text-secondary bg-opacity-10">⚠️ Penalty</span></td>
                  <td class="small">${escapeHtml(item.ref)}</td>
                  <td class="text-end fw-bold text-dark">${parseFloat(
                    item.amount,
                  ).toLocaleString()} ETB</td>
                  <td class="text-center"><span class="badge bg-light text-dark border">${
                    item.status
                  }</span></td>
              `;
        penaltyTableBody.appendChild(tr);
      });
    } else {
      penaltySection.classList.add("d-none");
    }
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
        '<tr><td colspan="7" class="text-center py-4 text-muted">No payment history found</td></tr>';
      return;
    }

    history.forEach((p) => {
      const tr = document.createElement("tr");
      // Global history now strictly contains 'paid' payments from backend
      let statusBadge =
        '<span class="badge bg-success bg-opacity-10 text-success">Paid</span>';

      let actionBtn = "";

      if (p.status === "processing") {
        statusBadge =
          '<span class="badge bg-info bg-opacity-10 text-info">Processing</span>';

        // Add Revert Button for Admins
        const user = auth.getUser();
        if (user && user.role === "admin") {
          actionBtn = `
                <button class="btn btn-sm btn-link text-danger p-0 ms-2 revert-payment-btn" data-id="${p.id}" title="Revert to Pending">
                    <i class="fas fa-undo"></i>
                </button>
              `;
        }
      }

      tr.innerHTML = `
                <td class="px-4 py-3 align-middle">${new Date(
                  p.payment_date,
                ).toLocaleDateString()}</td>
                <td class="px-4 py-3 align-middle">
                    <span class="badge ${p.payout_type === 'Standard' ? 'bg-info bg-opacity-10 text-info' : 'bg-danger bg-opacity-10 text-danger'} small fw-bold">
                        ${p.payout_type || 'Standard'}
                    </span>
                </td>
                <td class="px-4 py-3 align-middle fw-bold text-dark">${parseFloat(
                  p.total_amount,
                ).toLocaleString()} ETB</td>
                <td class="px-4 py-3 align-middle text-muted text-capitalize">${(
                  p.payment_method || ""
                ).replace("_", " ")}</td>
                <td class="px-4 py-3 align-middle">${statusBadge} ${actionBtn}</td>
                <td class="px-4 py-3 align-middle text-muted small">${
                  p.notes || "-"
                }</td>
                <td class="px-4 py-3 align-middle text-muted small">${
                  p.processed_by_name || "System"
                }</td>
            `;
      tbody.appendChild(tr);
    });

    // Attach Event Listeners for Revert Buttons
    document.querySelectorAll(".revert-payment-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // Secure Revert Flow
        revertPaymentId = e.currentTarget.dataset.id; // Store ID globally
        const revertModal = new bootstrap.Modal(
          document.getElementById("revertPasswordModal"),
        );
        document.getElementById("revertConfirmPassword").value = "";
        revertModal.show();
      });
    });

    // Handle Confirm Revert Click (One-time binding handled outside or check for existing listener)
    // To avoid multiple listeners, we can bind it once at the top level or use closure here CAREFULLY.
    // Better practice: Bind ONCE outside this loop. But since this function runs repeatedly,
    // we should use a named function or bind once.
    // For simplicity in this refactor, I'll attach it here but remove old listener if possible
    // OR better, move this logic out.

    // Actually, let's attach the listener to the modal button ONCE when the page loads,
    // and just set the ID here. See 'setupRevertModal' below.
    if (!window.revertModalSetupDone) {
      setupRevertModal();
      window.revertModalSetupDone = true;
    }
  } catch (error) {
    console.error("Failed to load payment history:", error);
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load history</td></tr>';
  }
}

let revertPaymentId = null;

function setupRevertModal() {
  const confirmBtn = document.getElementById("confirmRevertBtn");
  if (!confirmBtn) return;

  confirmBtn.addEventListener("click", async () => {
    const password = document.getElementById("revertConfirmPassword").value;
    if (!password) {
      ui.toast("Please enter your password", "error");
      return;
    }

    if (!revertPaymentId) return;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2"></span>Reverting...';

    try {
      await api.post(`/payments/${revertPaymentId}/revert`, {
        password: password,
      });

      ui.toast("Payment reverted successfully", "success");
      bootstrap.Modal.getInstance(
        document.getElementById("revertPasswordModal"),
      ).hide();

      // Refresh Data
      const driverId = new URLSearchParams(window.location.search).get("id");
      if (driverId) {
        loadPaymentHistory(driverId);
        loadBonuses(driverId);
        loadDebts(driverId);
        loadDriverDetails(driverId); // To refresh stats
      }
    } catch (error) {
      ui.toast(error.message || "Failed to revert payment", "error");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = "Confirm & Revert";
    }
  });
}

function renderDriver(driver, bonuses, currentUser) {
  document.getElementById("driverName").textContent = driver.full_name;
  document.getElementById("nameInitial").textContent =
    driver.full_name.charAt(0);
  document.getElementById("driverId").textContent = driver.driver_id;
  document.getElementById("driverPhone").textContent =
    driver.phone_number || "No phone";
  document.getElementById("createdAt").textContent = new Date(
    driver.created_at,
  ).toLocaleDateString();

  const badge = document.getElementById("driverStatusBadge");
  if (driver.is_blocked) {
    badge.textContent = "BLOCKED";
    badge.className = "badge-status bg-danger text-white";
  } else {
    badge.textContent = driver.verified ? "Verified" : "Unverified";
    badge.className = `badge-status ${
      driver.verified ? "badge-verified" : "badge-unverified"
    }`;
  }

  if (driver.verified) {
    // Button is already hidden by default (d-none), so no need to add it again.
    // Just show the verification info section.
    document
      .getElementById("verificationInfoSection")
      .classList.remove("d-none");
    document.getElementById("verifiedDateText").textContent = new Date(
      driver.verified_date,
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
      document.getElementById("tinOwnershipInfo").textContent =
        driver.tin_ownership || "Personal";

      if (driver.manager_photo) {
        const photoImg = document.getElementById("managerPhotoInfoImg");
        // Fix: Ensure base64 gets prefix if it's not present
        if (
          driver.manager_photo.startsWith("http") ||
          driver.manager_photo.startsWith("data:image") ||
          driver.manager_photo.startsWith("/imports")
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
  const total = bonuses.reduce((sum, b) => {
    const amount =
      b.final_payout !== null
        ? parseFloat(b.final_payout)
        : parseFloat(b.calculated_net_payout || 0);
    return sum + amount;
  }, 0);
  const totalGross = bonuses.reduce(
    (sum, b) => sum + parseFloat(b.calculated_gross_payout || 0),
    0,
  );
  const totalWithholding = bonuses.reduce(
    (sum, b) => sum + parseFloat(b.calculated_withholding_tax || 0),
    0,
  );

  document.getElementById("totalBonus").textContent = `${total.toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )} ETB`;

  // Update Reference Fields
  document.getElementById("totalGross").textContent =
    `${totalGross.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ETB`;
  document.getElementById("totalWithholding").textContent =
    `${totalWithholding.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ETB`;

  document.getElementById("weeksCount").textContent = bonuses.length;

  if (bonuses.length > 0) {
    const dates = bonuses
      .map((b) => new Date(b.week_date))
      .sort((a, b) => a - b);
    document.getElementById("bonusPeriod").textContent =
      `${dates[0].toLocaleDateString("en-US", {
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
              b.calculated_gross_payout || 0,
            ).toLocaleString()}</td>
            <td class="text-muted align-middle">${parseFloat(
              b.calculated_withholding_tax || 0,
            ).toLocaleString()}</td>
            <td class="text-end pe-4 fw-bold text-dark align-middle">
                ${parseFloat(
                  b.final_payout !== null ? b.final_payout : b.calculated_net_payout,
                ).toLocaleString()} ETB
                ${
                  b.final_payout !== null && b.final_payout < b.calculated_net_payout
                    ? `<i class="fas fa-info-circle text-danger ms-1" data-bs-toggle="tooltip" title="Original: ${parseFloat(
                        b.calculated_net_payout,
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
      parseFloat(b.final_payout !== null ? b.final_payout : b.calculated_net_payout || 0),
    0,
  );
  document.getElementById("totalBonus").textContent = `${total.toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )} ETB`;

  // Re-render period
  if (bonuses.length > 0) {
    document.getElementById("weeksCount").textContent = bonuses.length;
  }
}

async function loadBonuses(driverId) {
  try {
    const bonuses = await api.get(`/bonuses/driver/${driverId}`);
    renderBonusList(bonuses);
    updateTotalCalculations(bonuses);
  } catch (error) {
    console.error("Failed to load bonuses:", error);
  }
}

async function loadDriverDetails(driverId) {
  try {
    const driver = await api.get(`/drivers/${driverId}`);
    // We need to re-fetch bonuses to fully render the driver card (stats depend on it)
    // Or we can just update the specific fields if renderDriver is too heavy.
    // For simplicity, let's just fetch bonuses again or pass empty if we strictly want driver details.
    // Actually, renderDriver needs bonuses for stats.
    const bonuses = await api.get(`/bonuses/driver/${driverId}`);
    const currentUser = await api.get("/auth/me").catch(() => null);
    renderDriver(driver, bonuses, currentUser);
    if (window.renderPhoneHistory) {
      window.renderPhoneHistory(driver, currentUser);
    }
  } catch (error) {
    console.error("Failed to load driver details:", error);
  }
}
