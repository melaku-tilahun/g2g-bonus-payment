// ========== TELEBIRR VERIFICATION - PHONE HISTORY ==========

// Render phone history table
window.renderPhoneHistory = function (driver, currentUser) {
  const phoneHistory = driver.phone_history || [];
  const phoneHistorySection = document.getElementById("phoneHistorySection");
  const phoneHistoryTableBody = document.getElementById(
    "phoneHistoryTableBody",
  );
  const telebirrStatusBadge = document.getElementById("telebirrStatusBadge");

  if (phoneHistory.length === 0) {
    phoneHistorySection.style.display = "none";
    return;
  }

  phoneHistorySection.style.display = "block";

  // Show telebirr status badge
  if (!driver.is_telebirr_verified) {
    telebirrStatusBadge.innerHTML = `
      <span class="badge bg-warning text-dark">
        <i class="fas fa-exclamation-triangle me-1"></i> Telebirr Unverified
      </span>`;
  } else {
    telebirrStatusBadge.innerHTML = `
      <span class="badge bg-success">
        <i class="fas fa-check-circle me-1"></i> Telebirr Verified
      </span>`;
  }

  // Render table
  phoneHistoryTableBody.innerHTML = "";

  phoneHistory.forEach((phone) => {
    const tr = document.createElement("tr");

    // Status badge
    let statusBadge = "";
    if (phone.status === "active") {
      statusBadge =
        '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i> Active</span>';
    } else if (phone.status === "pending") {
      statusBadge =
        '<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i> Pending</span>';
    } else if (phone.status === "inactive") {
      statusBadge =
        '<span class="badge bg-secondary"><i class="fas fa-archive me-1 "></i> Inactive</span>';
    } else if (phone.status === "rejected") {
      statusBadge =
        '<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i> Rejected</span>';
    }

    // Valid period
    let validPeriod = "-";
    if (phone.valid_from && phone.status === "active") {
      validPeriod = `Since ${new Date(phone.valid_from).toLocaleDateString()}`;
    } else if (phone.valid_from && phone.valid_to) {
      validPeriod = `${new Date(phone.valid_from).toLocaleDateString()} - ${new Date(phone.valid_to).toLocaleDateString()}`;
    }

    // Reason tooltip (if long) or text
    let reasonText = phone.reason || phone.rejection_reason || "-";
    if (reasonText.length > 30) {
      reasonText = `<span data-bs-toggle="tooltip" title="${escapeHtml(reasonText)}">${escapeHtml(reasonText.substring(0, 30))}...</span>`;
    } else {
      reasonText = escapeHtml(reasonText);
    }

    // Action buttons
    let actions = "";
    const canVerify =
      currentUser &&
      ["admin", "director", "manager"].includes(currentUser.role);

    // 1. Verify/Approve Pending
    const needsVerification =
      phone.status === "pending" ||
      (phone.status === "active" && !driver.is_telebirr_verified);

    if (needsVerification && canVerify) {
      actions += `
        <button class="btn btn-sm btn-outline-success rounded-pill px-3 verify-phone-btn mb-1" 
                data-phone-id="${phone.id}" 
                data-phone-number="${phone.phone_number}"
                data-action="approve">
          <i class="fas fa-check me-1"></i> Verify
        </button>
      `;

      if (phone.status === "pending") {
        actions += `
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3 ms-1 verify-phone-btn mb-1" 
                data-phone-id="${phone.id}"
                data-phone-number="${phone.phone_number}"
                data-action="reject">
          <i class="fas fa-times me-1"></i> Reject
        </button>`;
      }
    }

    // 2. Reactivate Inactive/Rejected (Switch to this number)
    // Only if not already active and not pending (pending handled above)
    if (
      (phone.status === "inactive" || phone.status === "rejected") &&
      canVerify
    ) {
      actions += `
        <button class="btn btn-sm btn-outline-primary rounded-pill px-3 verify-phone-btn" 
                data-phone-id="${phone.id}" 
                data-phone-number="${phone.phone_number}"
                data-action="approve">
          <i class="fas fa-undo me-1"></i> Set Active
        </button>`;
    }

    if (!actions) actions = "-";

    tr.innerHTML = `
      <td class="px-4 py-3 font-monospace fw-bold">${phone.phone_number}</td>
      <td class="px-4 py-3">${statusBadge}</td>
      <td class="px-4 py-3 text-muted small">${new Date(phone.added_at).toLocaleDateString()}</td>
      <td class="px-4 py-3 text-muted small">${validPeriod}</td>
      <td class="px-4 py-3 text-muted small">${phone.approved_by_name || "-"}</td>
      <td class="px-4 py-3 text-muted small">${reasonText}</td>
      <td class="px-4 py-3 text-center">${actions}</td>
    `;

    phoneHistoryTableBody.appendChild(tr);
  });

  // Initialize tooltips
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]',
  );
  [...tooltipTriggerList].map(
    (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl),
  );

  // Attach event listeners to verify buttons
  document.querySelectorAll(".verify-phone-btn").forEach((btn) => {
    btn.onclick = () => {
      const phoneId = btn.dataset.phoneId;
      const phoneNumber = btn.dataset.phoneNumber;
      const action = btn.dataset.action;
      showPhoneVerificationModal(
        driver.phone_number,
        phoneNumber,
        phoneId,
        action,
      );
    };
  });
};

function showPhoneVerificationModal(
  currentPhone,
  pendingPhone,
  phoneRecordId,
  action,
) {
  const modal = new bootstrap.Modal(
    document.getElementById("verifyPhoneModal"),
  );
  const isSelfVerify = currentPhone && pendingPhone === currentPhone; // Verifying the active number itself

  // Elements
  const modalTitle = document.querySelector("#verifyPhoneModal .modal-title");
  const modalAlert = document.querySelector("#verifyPhoneModal .alert");
  const comparisonRow = document.getElementById("modalComparisonRow");
  const currentPhoneCol = document.getElementById("modalCurrentPhoneCol");
  const pendingPhoneCard = document.getElementById("pendingPhoneCard"); // Parent col of this needs handling if we want to hide it

  // Reset previous state
  document.getElementById("modalCurrentPhone").textContent =
    currentPhone || "---";
  document.getElementById("modalPendingPhone").textContent =
    pendingPhone || "---";
  document.getElementById("phoneRecordId").value = phoneRecordId;
  document.getElementById("phoneAction").value = action;
  document.getElementById("phoneVerifyReason").value = "";

  // UI Customization based on Action & Context
  if (action === "approve") {
    if (isSelfVerify) {
      // Case 1: verifying the currently active number (Single Confirmation)
      modalTitle.innerHTML =
        '<i class="fas fa-check-circle me-2"></i> Confirm Verification';
      modalAlert.className =
        "alert alert-info bg-info bg-opacity-10 border-0 mb-4";
      modalAlert.innerHTML = `
            <i class="fas fa-info-circle me-2"></i> 
            <strong>Verify Active Number</strong>
            <p class="mb-0 mt-2 small">You are verifying the existing active phone number <strong>${currentPhone}</strong> for Telebirr payments.</p>
          `;

      // Hide comparison, show only the active card centered?
      // Actually simplest is to hide the "New Phone" column and center the "Current" one, or just hide the whole comparison row and use the alert.
      // Let's hide the comparison row for simplicity in this mode.
      comparisonRow.style.display = "none";
    } else {
      // Case 2: Approving a NEW pending number (Change Request)
      modalTitle.innerHTML =
        '<i class="fas fa-mobile-alt me-2"></i> Verify Phone Change';
      modalAlert.className =
        "alert alert-warning bg-warning bg-opacity-10 border-0 mb-4";
      modalAlert.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i> 
            <strong>Phone Number Change Detected</strong>
            <p class="mb-0 mt-2 small">You are approving a change from <strong>${currentPhone || "None"}</strong> to <strong>${pendingPhone}</strong>.</p>
          `;
      comparisonRow.style.display = "flex";
      // Ensure both columns are visible (reset if hidden previously)
      // We can't strictly reset Bootstrap cols easily without class manipulation, but display:flex on row handles children.
    }

    document.getElementById("approveNewPhoneBtn").style.display =
      "inline-block";
    document.getElementById("rejectNewPhoneBtn").style.display = "none";
    document.getElementById("approveNewPhoneBtn").textContent = isSelfVerify
      ? "Confirm Verification"
      : "Use New Phone";
  } else if (action === "reject") {
    // Case 3: Rejecting a pending number
    modalTitle.innerHTML =
      '<i class="fas fa-times-circle me-2"></i> Reject Phone Number';
    modalAlert.className =
      "alert alert-danger bg-danger bg-opacity-10 border-0 mb-4";
    modalAlert.innerHTML = `
        <i class="fas fa-ban me-2"></i> 
        <strong>Reject Phone Number</strong>
        <p class="mb-0 mt-2 small">You are rejecting the pending number <strong>${pendingPhone}</strong>. The driver will remain on the current configuration.</p>
      `;
    comparisonRow.style.display = "none"; // Hide comparison for reject, reason is enough

    document.getElementById("approveNewPhoneBtn").style.display = "none";
    document.getElementById("rejectNewPhoneBtn").style.display = "inline-block";
  }

  modal.show();
}

// Approve new phone button handler
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("approveNewPhoneBtn").onclick = async () => {
    const phoneRecordId = document.getElementById("phoneRecordId").value;
    const reason = document.getElementById("phoneVerifyReason").value.trim();

    if (!reason) {
      ui.toast(
        "Please provide a reason for approving this phone number",
        "error",
      );
      return;
    }

    await verifyPhone(phoneRecordId, "approve", reason);
  };

  // Reject new phone button handler
  document.getElementById("rejectNewPhoneBtn").onclick = async () => {
    const phoneRecordId = document.getElementById("phoneRecordId").value;
    const reason = document.getElementById("phoneVerifyReason").value.trim();

    if (!reason) {
      ui.toast(
        "Please provide a reason for rejecting this phone number",
        "error",
      );
      return;
    }

    await verifyPhone(phoneRecordId, "reject", reason);
  };
});

async function verifyPhone(phoneRecordId, action, reason) {
  const params = new URLSearchParams(window.location.search);
  const driverId = params.get("id");

  try {
    ui.showLoading(true);
    await api.post(`/drivers/${driverId}/verify-phone`, {
      phone_record_id: phoneRecordId,
      action: action,
      reason: reason,
    });

    ui.toast(
      `Phone number ${action === "approve" ? "approved" : "rejected"} successfully`,
      "success",
    );

    // Close modal
    bootstrap.Modal.getInstance(
      document.getElementById("verifyPhoneModal"),
    ).hide();

    // Reload driver details to refresh phone history
    const driver = await api.get(`/drivers/${driverId}`);
    const currentUser = await api.get("/auth/me").catch(() => null);
    renderPhoneHistory(driver, currentUser);

    // Refresh the page to update all driver info
    window.location.reload();
  } catch (error) {
    console.error("Phone verification error:", error);
    ui.toast(error.message || "Failed to verify phone number", "error");
  } finally {
    ui.showLoading(false);
  }
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text ? text.replace(/[&<>"']/g, (m) => map[m]) : "";
}
