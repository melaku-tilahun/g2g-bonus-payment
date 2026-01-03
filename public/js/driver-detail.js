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
      if (data.managerPhoto.startsWith("http")) {
        photoImg.src = data.managerPhoto;
      } else if (data.managerPhoto.startsWith("data:image")) {
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

  // Revert Logic
  const revertModal = new bootstrap.Modal(
    document.getElementById("revertModal")
  );

  document.getElementById("revertVerifiedBtn").onclick = () => {
    // Clear fields
    document.getElementById("revertPassword").value = "";
    document.getElementById("revertReason").value = "";
    revertModal.show();
  };

  document.getElementById("confirmRevertBtn").onclick = async () => {
    const password = document.getElementById("revertPassword").value;
    const reason = document.getElementById("revertReason").value;

    if (!password) {
      ui.toast("Password is required", "error");
      return;
    }

    const btn = document.getElementById("confirmRevertBtn");
    try {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span> Reverting...';

      await api.put(`/drivers/${driverId}/revert`, { password, reason });

      ui.toast("Verification reverted successfully", "success");
      revertModal.hide();
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error(error);
      ui.toast(error.message || "Failed to revert verification", "error");
      btn.disabled = false;
      btn.textContent = "Revert Status";
    }
  };
});

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
    const history = await api.get(`/payments/history?driver_id=${driverId}`);
    tbody.innerHTML = "";

    if (history.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center py-4 text-muted">No payment history found</td></tr>';
      return;
    }

    history.forEach((p) => {
      const tr = document.createElement("tr");
      const statusBadge =
        p.status === "paid"
          ? '<span class="badge bg-success bg-opacity-10 text-success">Paid</span>'
          : '<span class="badge bg-warning bg-opacity-10 text-warning">Processing</span>';

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

    // Show Revert Button ONLY for Admins
    if (currentUser && currentUser.role === "admin") {
      document.getElementById("revertVerifiedBtn").classList.remove("d-none");
    }
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
          driver.manager_photo.startsWith("data:image")
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
      const isPaid = !!b.payment_id;
      const tr = document.createElement("tr");
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
                ${
                  isPaid
                    ? '<span class="badge bg-success bg-opacity-10 text-success rounded-pill px-2">Paid</span>'
                    : '<span class="badge bg-warning bg-opacity-10 text-warning rounded-pill px-2">Pending</span>'
                }
            </td>
            <td class="text-muted align-middle">${parseFloat(
              b.gross_payout || 0
            ).toLocaleString()}</td>
            <td class="text-muted align-middle">${parseFloat(
              b.withholding_tax || 0
            ).toLocaleString()}</td>
            <td class="text-end pe-4 fw-bold text-dark align-middle">${parseFloat(
              b.net_payout
            ).toLocaleString()} ETB</td>
        `;
      tbody.appendChild(tr);
    });
}
