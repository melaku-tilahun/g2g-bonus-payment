document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const driverId = params.get("id");

  if (!driverId) {
    window.location.href = "/index.html";
    return;
  }

  const modal = new bootstrap.Modal(document.getElementById("verifyModal"));
  const payModal = new bootstrap.Modal(document.getElementById("paymentModal"));

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
    renderDriver(driver, bonuses);
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
    ?.addEventListener("change", updateVerifyButtonState);

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

  // Payment Logic
  document.getElementById("processPaymentBtn").onclick = () => {
    document.getElementById("payDriverName").textContent =
      document.getElementById("driverName").textContent;
    document.getElementById("payAmount").value = document
      .getElementById("totalBonus")
      .textContent.replace(" ETB", "")
      .replace(/,/g, "");
    document.getElementById("payDate").valueAsDate = new Date();
    payModal.show();
  };

  document.getElementById("confirmPayBtn").onclick = async () => {
    const amount = document.getElementById("payAmount").value;
    const method = document.getElementById("payMethod").value;
    const periodStart = document.getElementById("payPeriodStart").value;
    const periodEnd = document.getElementById("payPeriodEnd").value;
    const notes = document.getElementById("payNotes").value;

    const btn = document.getElementById("confirmPayBtn");
    try {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Recording...';

      await api.post("/payments", {
        driver_id: driverId,
        total_amount: amount,
        payment_method: method,
        bonus_period_start: periodStart,
        bonus_period_end: periodEnd,
        notes: notes,
      });

      ui.toast("Payment recorded successfully!", "success");
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      payModal.hide();
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      ui.toast(error.message || "Payment failed", "error");
      btn.disabled = false;
      btn.textContent = "Record Payment";
    }
  };
});

function showSkeletons() {
  document.getElementById("bonusHistoryList").innerHTML = `
        <div class="skeleton skeleton-text w-75 mb-4"></div>
        <div class="skeleton skeleton-text w-100 mb-2"></div>
        <div class="skeleton skeleton-text w-50 mb-2"></div>
        <div class="skeleton skeleton-text w-100 mb-4"></div>
    `;
}

function renderDriver(driver, bonuses) {
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
    document.getElementById("processPaymentBtn").classList.remove("d-none");
    document
      .getElementById("verificationInfoSection")
      .classList.remove("d-none");
    document.getElementById("verifiedDateText").textContent = new Date(
      driver.verified_date
    ).toLocaleDateString();
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
        document.getElementById("managerPhotoInfoImg").src =
          driver.manager_photo;
        document.getElementById("managerPhotoInfo").style.display = "block";
      }
    }
  }

  const total = bonuses.reduce((sum, b) => sum + parseFloat(b.net_payout), 0);
  document.getElementById(
    "totalBonus"
  ).textContent = `${total.toLocaleString()} ETB`;
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
    document.getElementById("bonusHistoryList").innerHTML = "";
    document.getElementById("emptyBonusState").classList.remove("d-none");
  }
}

function renderBonusList(bonuses) {
  const container = document.getElementById("bonusHistoryList");
  container.innerHTML = "";

  bonuses
    .sort((a, b) => new Date(b.week_date) - new Date(a.week_date))
    .forEach((b) => {
      const div = document.createElement("div");
      div.className = "card-premium mb-3 p-3 border-0 bg-light";
      div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="small text-muted text-uppercase fw-bold mb-1">Week Ending</div>
                    <div class="fw-bold">${new Date(
                      b.week_date
                    ).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}</div>
                </div>
                <div class="text-end">
                    <div class="h5 fw-bold text-primary mb-0">${parseFloat(
                      b.net_payout
                    ).toLocaleString()} ETB</div>
                    <div class="small text-muted">Ref: ${
                      b.file_name || "Manual Import"
                    }</div>
                </div>
            </div>
        `;
      container.appendChild(div);
    });
}
