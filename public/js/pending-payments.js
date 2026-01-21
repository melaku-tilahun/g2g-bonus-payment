document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("pendingTableBody");
  const searchInput = document.getElementById("pendingSearchInput");
  const exportBtn = document.getElementById("exportExcelBtn");
  const paginationContainer = document.getElementById("paginationContainer");

  let currentPage = 1;
  const currentLimit = 25;
  let activeStatus = "pending";
  let debounceTimer;

  // Tab switching logic
  const tabs = document.querySelectorAll("#paymentTabs button");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeStatus = tab.getAttribute("data-status");
      updateButtonVisibility();
      if (activeStatus === "history") {
        loadExportHistory(1);
      } else {
        loadPendingPayments(1);
      }
    });
  });

  function updateButtonVisibility() {
    const exportBtnWrapper = document.getElementById("exportExcelBtn");
    const reconcileBtnWrapper = document.getElementById("reconcileBtn");

    // Permission Check: Auditors cannot export or reconcile
    const user = auth.getUser();
    if (user && user.role === "auditor") {
      exportBtnWrapper.classList.add("d-none");
      reconcileBtnWrapper.classList.add("d-none");
      return;
    }

    if (activeStatus === "pending") {
      exportBtnWrapper.classList.remove("d-none");
      reconcileBtnWrapper.classList.add("d-none");
    } else if (activeStatus === "processing") {
      exportBtnWrapper.classList.add("d-none");
      reconcileBtnWrapper.classList.remove("d-none");
    } else {
      // History tab
      exportBtnWrapper.classList.add("d-none");
      reconcileBtnWrapper.classList.add("d-none");
    }
  }

  async function loadPendingPayments(page = 1) {
    try {
      const query = searchInput.value.trim();
      const params = new URLSearchParams({
        page: page,
        limit: currentLimit,
        q: query,
        status: activeStatus,
      });

      const response = await api.get(`/payments/pending?${params.toString()}`);

      const drivers = response.pending_drivers || [];
      const pagination = response.pagination || { page: 1, total_pages: 1 };
      const counts = response.counts || {
        pending: 0,
        processing: 0,
        verification_needed: 0,
      };

      updateBadges(counts);
      renderTable(drivers, pagination.page);
      renderPagination(pagination);
      currentPage = page;
    } catch (error) {
      console.error("Error loading pending payments:", error);
      tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-danger">
                        <i class="fas fa-exclamation-circle fa-2x mb-2"></i>
                        <div>Failed to load pending payments. Please try again.</div>
                    </td>
                </tr>
            `;
    }
  }

  function renderTable(data, page) {
    // Reset headers if they were changed by history view
    const thead = document.querySelector("#pendingTable thead");
    const isProcessingTab = document
      .querySelector('.nav-link[data-status="processing"]')
      .classList.contains("active");

    const isVerificationTab = document
      .querySelector('.nav-link[data-status="verification_needed"]')
      .classList.contains("active");

    const phoneColumnHeader = isVerificationTab
      ? '<th class="py-3">Pending Phone</th>'
      : '<th class="py-3">Driver ID</th>';

    // For verification tab, swap Driver ID column for Pending Phone or add it?
    // User wants to see pending phone to call.
    // Let's keep Driver ID and ADD Pending Phone if in verification tab.

    let headerHtml = `
      <tr>
          <th class="px-4 py-3">#</th>
          <th class="py-3">Driver</th>
          <th class="py-3">Driver ID</th>
          ${isProcessingTab ? '<th class="py-3">Batch</th>' : ""}
          ${isVerificationTab ? '<th class="py-3">Pending Phone</th>' : ""}
          <th class="py-3 text-center">Weeks</th>
          <th class="py-3 text-end">Total Amount</th>
          <th class="py-3 text-center px-4">Action</th>
      </tr>
    `;
    thead.innerHTML = headerHtml;

    if (!data || data.length === 0) {
      tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="fas fa-check-circle fa-2x mb-2 text-success"></i>
                        <div>No pending payments found.</div>
                    </td>
                </tr>
            `;
      return;
    }

    tableBody.innerHTML = data
      .map((item, index) => {
        const rowNumber = (page - 1) * currentLimit + index + 1;
        const isExported = item.status === "processing";

        let actionBtn = "";
        if (isVerificationTab) {
          actionBtn = `
                <a href="/pages/driver-detail.html?id=${item.driver_id}" class="btn btn-sm btn-outline-primary rounded-pill px-3">
                    <i class="fas fa-user-edit me-1"></i> Review Profile
                </a>
            `;
        } else {
          actionBtn = `
                <a href="/pages/driver-detail.html?id=${item.driver_id}" class="btn btn-sm btn-outline-primary rounded-pill px-3">
                    View Details
                </a>
            `;
        }

        return `
            <tr>
                <td class="px-4 text-muted small">${rowNumber}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="fw-bold text-dark">${item.full_name}</div>
                        ${
                          isExported
                            ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 x-small">Exported</span>'
                            : isVerificationTab
                              ? '<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 x-small">Telebirr Verification Needed</span>'
                              : '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 x-small">Pending</span>'
                        }
                    </div>
                    ${!isVerificationTab ? `<div class="small text-muted">${item.phone_number || "No phone"}</div>` : ""}
                </td>
                <td><span class="badge bg-light text-dark font-monospace">${item.driver_id}</span></td>
                ${
                  isProcessingTab
                    ? `<td class="small text-muted font-monospace">${item.batch_id || "N/A"}</td>`
                    : ""
                }
                ${
                  isVerificationTab
                    ? `<td>
                        ${
                          item.pending_phone
                            ? `<span class="badge bg-warning text-dark border border-warning"><i class="fas fa-clock me-1"></i>${item.pending_phone}</span>`
                            : `<span class="small text-muted fst-italic">No pending request</span>`
                        }
                       </td>`
                    : ""
                }
                <td class="text-center">
                    <span class="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3">
                        ${item.pending_weeks} Weeks
                    </span>
                </td>
                <td class="text-end fw-bold text-dark">
                    ${parseFloat(item.total_pending_amount).toLocaleString()} <span class="small text-muted fw-normal">ETB</span>
                </td>
                <td class="text-center px-4">
                    ${actionBtn}
                </td>
            </tr>
        `;
      })
      .join("");
  }

  function renderPagination(pagination) {
    if (pagination.total_pages <= 1) {
      paginationContainer.classList.add("d-none");
      return;
    }

    paginationContainer.classList.remove("d-none");
    paginationContainer.innerHTML = `
            <nav>
                <ul class="pagination pagination-rounded shadow-sm">
                    <li class="page-item ${
                      pagination.page <= 1 ? "disabled" : ""
                    }">
                        <a class="page-link" href="#" onclick="event.preventDefault(); window.changePage(${
                          pagination.page - 1
                        })">Previous</a>
                    </li>
                    <li class="page-item active">
                        <a class="page-link" href="#">Page ${
                          pagination.page
                        } of ${pagination.total_pages}</a>
                    </li>
                    <li class="page-item ${
                      pagination.page >= pagination.total_pages
                        ? "disabled"
                        : ""
                    }">
                        <a class="page-link" href="#" onclick="event.preventDefault(); window.changePage(${
                          pagination.page + 1
                        })">Next</a>
                    </li>
                </ul>
            </nav>
        `;
  }

  window.changePage = (page) => {
    loadPendingPayments(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Search functionality
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadPendingPayments(1), 300);
  });

  // Export functionality
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      exportBtn.disabled = true;
      const originalHtml = exportBtn.innerHTML;
      exportBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Exporting...';

      try {
        const response = await fetch("/api/payments/export/pending", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to export");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = new Date().toISOString().split("T")[0];
        a.download = `G2G_PAYMENTS_${date}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Refresh list to show 'Processing' status
        await loadPendingPayments(currentPage);
      } catch (error) {
        console.error("Export error:", error);
        alert(error.message || "Failed to export payments. Please try again.");
      } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalHtml;
      }
    });
  }

  // Reconciliation logic
  const reconcileBtn = document.getElementById("reconcileBtn");
  const startReconcileBtn = document.getElementById("startReconcileBtn");
  const confirmReconcileBtn = document.getElementById("confirmReconcileBtn");
  const reconcileBackBtn = document.getElementById("reconcileBackBtn");
  const receiptFileInput = document.getElementById("receiptFile");
  const reconcileModalElement = document.getElementById("reconcileModal");

  const importState = document.getElementById("reconcileImportState");
  const reviewState = document.getElementById("reconcileReviewState");
  const successState = document.getElementById("reconcileSuccessState");
  const successSummary = document.getElementById("reconcileSuccessSummary");
  const summaryContainer = document.getElementById("reconcileSummary");
  const modalTitle = document.getElementById("reconcileModalTitle");
  const reconcileCancelBtn = document.getElementById("reconcileCancelBtn");

  let reconcileModal;
  let currentTempFile = null;

  const reconcileError = document.getElementById("reconcileError");

  if (reconcileBtn) {
    reconcileModal = new bootstrap.Modal(reconcileModalElement);
    reconcileBtn.addEventListener("click", () => {
      resetReconcileModal();
      reconcileModal.show();
    });
  }

  function showReconcileError(msg) {
    if (!reconcileError) return;
    reconcileError.querySelector(".error-text").innerText = msg;
    reconcileError.classList.remove("d-none");
    // Scroll modal to top to show error
    reconcileModalElement.querySelector(".modal-body").scrollTop = 0;
  }

  function clearReconcileError() {
    if (!reconcileError) return;
    reconcileError.classList.add("d-none");
  }

  function resetReconcileModal() {
    receiptFileInput.value = "";
    importState.classList.remove("d-none");
    reviewState.classList.add("d-none");
    successState.classList.add("d-none");
    startReconcileBtn.classList.remove("d-none");
    confirmReconcileBtn.classList.add("d-none");
    reconcileBackBtn.classList.add("d-none");
    reconcileCancelBtn.classList.remove("d-none");
    reconcileCancelBtn.innerText = "Cancel";
    modalTitle.innerText = "Reconcile with Receipt";
    startReconcileBtn.disabled = false;
    startReconcileBtn.innerHTML = "Validate Receipt";
    currentTempFile = null;
    clearReconcileError();
  }

  if (startReconcileBtn) {
    startReconcileBtn.addEventListener("click", async () => {
      clearReconcileError();
      const file = receiptFileInput.files[0];
      if (!file) {
        showReconcileError("Please select an Excel file first.");
        return;
      }

      startReconcileBtn.disabled = true;
      startReconcileBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Validating...';

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await api.post(
          "/payments/reconcile/validate",
          formData,
        );

        if (response.success) {
          currentTempFile = response.tempFileName;
          showReviewState(response);
        } else {
          // If structure failed, we still show the review state with error checklist
          currentTempFile = response.tempFileName;
          showReviewState(response);
          if (response.message) {
            showReconcileError(response.message);
          }
        }
      } catch (error) {
        console.error("Validation error:", error);
        showReconcileError(
          error.message || "Failed to validate reconciliation file.",
        );
        // We stay in import state on hard error
      } finally {
        startReconcileBtn.disabled = false;
        startReconcileBtn.innerHTML = "Validate Receipt";
      }
    });
  }

  function showReviewState(response) {
    const summary = response.summary || {
      totalRows: 0,
      validPayments: 0,
      unmatched: 0,
      alreadyPaid: 0,
      totalAmount: 0,
      unmatchedPhones: [],
      unmatchedDetails: [], // NEW
      amountMismatches: [],
      invalidMetadata: [], // NEW
      skippedNonB2C: 0, // NEW
    };
    const checklist = response.checklist || [];
    const isSuccess = response.success;
    const errorMessage =
      response.message ||
      "Structural errors detected. Please fix the Excel file before proceeding.";

    importState.classList.add("d-none");
    reviewState.classList.remove("d-none");
    startReconcileBtn.classList.add("d-none");
    confirmReconcileBtn.classList.remove("d-none");
    reconcileBackBtn.classList.remove("d-none");
    modalTitle.innerText = "Review Reconciliation";

    // 1. Render Checklist
    const checklistHtml = checklist
      .map(
        (item) => `
        <div class="list-group-item d-flex justify-content-between align-items-center py-2 px-3 ${
          item.status === "failed" ? "bg-danger bg-opacity-10" : ""
        }">
            <span class="small">${item.item}</span>
            <span class="badge ${
              item.status === "passed" ? "text-success" : "text-danger"
            }">${item.icon}</span>
        </div>
    `,
      )
      .join("");
    document.getElementById("reconcileChecklist").innerHTML = checklistHtml;

    // 2. Render Matching Summary
    summaryContainer.innerHTML = `
      ${
        summary.metadata
          ? `
        <div class="summary-item-card border-0 mb-3" style="background: rgba(255,255,255,0.6);">
            <div class="row g-2">
                <div class="col-6">
                    <div class="label">Organization</div>
                    <div class="fw-bold small text-dark">${
                      summary.metadata.organization || "N/A"
                    }</div>
                </div>
                <div class="col-6">
                    <div class="label">Bulk Plan ID</div>
                    <div class="fw-bold small text-dark">${
                      summary.metadata.planId || "N/A"
                    }</div>
                </div>
            </div>
        </div>
      `
          : ""
      }
      <div class="row g-3">
        <div class="col-6">
          <div class="summary-item-card">
            <div class="label">Total Records</div>
            <div class="value">${summary.totalRows}</div>
          </div>
        </div>
        <div class="col-6">
          <div class="summary-item-card">
            <div class="label text-success">To be Reconciled</div>
            <div class="value text-success">${summary.validPayments}</div>
          </div>
        </div>
        <div class="col-6">
          <div class="summary-item-card">
            <div class="label text-warning">Skipped/Paid</div>
            <div class="value text-warning">${summary.alreadyPaid}</div>
          </div>
        </div>
        <div class="col-6">
          <div class="summary-item-card">
            <div class="label text-danger">Unmatched</div>
            <div class="value text-danger">${summary.unmatched}</div>
          </div>
        </div>
        <div class="col-12">
          <div class="summary-item-card highlight">
            <div class="label text-brand">Total Amount Found</div>
            <div class="value text-brand">${summary.totalAmount.toLocaleString()} <span class="small fw-normal">ETB</span></div>
          </div>
        </div>
      </div>
      
      ${
        summary.invalidMetadata && summary.invalidMetadata.length > 0
          ? `
        <div class="mt-4">
            <div class="fw-bold text-warning mb-2"><i class="fas fa-exclamation-triangle me-2"></i>Invalid Metadata Format (${summary.invalidMetadata.length})</div>
            <div class="table-responsive">
                <table class="table table-sm table-bordered mb-0 small">
                    <thead class="table-warning">
                        <tr>
                            <th>Row</th>
                            <th>Amount</th>
                            <th>Found</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.invalidMetadata
                          .map(
                            (m) => `
                            <tr>
                                <td>${m.row}</td>
                                <td>${m.amount ? m.amount.toLocaleString() + " ETB" : "N/A"}</td>
                                <td class="font-monospace text-danger small">${m.found.substring(0, 30)}...</td>
                                <td class="small">${m.reason}</td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
                <p class="small text-muted mb-0 mt-2"><i class="fas fa-info-circle me-1"></i>Expected format: DriverID.BonusID.WeekDate.BatchID</p>
            </div>
        </div>
      `
          : ""
      }

      ${
        summary.amountMismatches && summary.amountMismatches.length > 0
          ? `
        <div class="mt-4">
            <div class="fw-bold text-danger mb-2"><i class="fas fa-exclamation-circle me-2"></i>Amount Discrepancy (${summary.amountMismatches.length})</div>
            <div class="table-responsive">
                <table class="table table-sm table-bordered mb-0 small">
                    <thead class="table-danger">
                        <tr>
                            <th>Row</th>
                            <th>Driver ID</th>
                            <th>Bonus ID</th>
                            <th>File Amount</th>
                            <th>Expected</th>
                            <th>Difference</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.amountMismatches
                          .map(
                            (m) => `
                            <tr>
                                <td>${m.row}</td>
                                <td class="font-monospace small">${m.driverId || "N/A"}</td>
                                <td>${m.bonusId}</td>
                                <td class="text-danger">${m.fileAmount.toLocaleString()} ETB</td>
                                <td class="text-success">${m.dbAmount.toLocaleString()} ETB</td>
                                <td class="text-warning">${m.difference ? m.difference + " ETB" : "N/A"}</td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        </div>
      `
          : ""
      }

      ${
        summary.unmatchedDetails &&
        summary.unmatchedDetails.length > 0 &&
        isSuccess
          ? `
        <div class="mt-4">
          <div class="fw-bold text-danger mb-2"><i class="fas fa-times-circle me-2"></i>Unmatched Records (${summary.unmatchedDetails.length})</div>
          <div class="accordion" id="unmatchedAccordion">
            ${summary.unmatchedDetails
              .map(
                (detail, idx) => `
              <div class="accordion-item border">
                <h2 class="accordion-header" id="heading${idx}">
                  <button class="accordion-button collapsed py-2 small" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
                    <span class="badge bg-danger me-2">Row ${detail.row}</span>
                    <span class="text-truncate">${detail.amount ? detail.amount.toLocaleString() + " ETB" : ""} - ${detail.reason}</span>
                  </button>
                </h2>
                <div id="collapse${idx}" class="accordion-collapse collapse" data-bs-parent="#unmatchedAccordion">
                  <div class="accordion-body small bg-light">
                    <div class="mb-2"><strong>Reason:</strong> ${detail.reason}</div>
                    ${detail.amount ? `<div class="mb-2"><strong>Amount:</strong> ${detail.amount.toLocaleString()} ETB</div>` : ""}
                    ${
                      detail.metadata && typeof detail.metadata === "object"
                        ? `
                      <div class="mb-2"><strong>Metadata:</strong>
                        <div class="font-monospace small text-muted mt-1">
                          ${Object.entries(detail.metadata)
                            .map(([key, val]) => `${key}: ${val}`)
                            .join("<br>")}
                        </div>
                      </div>
                    `
                        : detail.metadata
                          ? `<div class="mb-2 font-monospace text-muted small">${detail.metadata}</div>`
                          : ""
                    }
                    ${detail.suggestion ? `<div class="alert alert-info mb-0 py-1 px-2 small"><i class="fas fa-lightbulb me-1"></i>${detail.suggestion}</div>` : ""}
                  </div>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
          : summary.unmatchedPhones &&
              summary.unmatchedPhones.length > 0 &&
              isSuccess
            ? `
        <div class="mt-3 small text-danger">
          <div class="fw-bold mb-2"><i class="fas fa-exclamation-triangle me-1"></i> Unmatched Records:</div>
          <div class="bg-white p-2 rounded border small font-monospace">${summary.unmatchedPhones.join(
            "<br>",
          )}</div>
        </div>
      `
            : ""
      }
      
      ${
        summary.skippedNonB2C && summary.skippedNonB2C > 0
          ? `
        <div class="mt-3 small text-muted">
          <i class="fas fa-info-circle me-1"></i> ${summary.skippedNonB2C} non-B2C transactions were skipped
        </div>
      `
          : ""
      }
    `;

    // 3. Handle Failure State or No Valid Payments
    if (!isSuccess || summary.validPayments === 0) {
      confirmReconcileBtn.disabled = true;
      confirmReconcileBtn.classList.replace("btn-success", "btn-secondary");

      if (!isSuccess) {
        confirmReconcileBtn.innerHTML =
          '<i class="fas fa-times me-2"></i> Cannot Process';
        summaryContainer.innerHTML += `
          <div class="alert alert-danger border-0 rounded-3 mt-3 mb-0 small">
              <i class="fas fa-exclamation-triangle me-2"></i> 
              ${errorMessage}
          </div>
        `;
      } else if (summary.validPayments === 0) {
        confirmReconcileBtn.innerHTML =
          '<i class="fas fa-ban me-2"></i> No Valid Payments';
        summaryContainer.innerHTML += `
          <div class="alert alert-warning border-0 rounded-3 mt-3 mb-0 small">
              <i class="fas fa-info-circle me-2"></i> 
              No valid payments found to reconcile. All records are either already paid, unmatched, or have errors.
          </div>
        `;
      }
    } else {
      confirmReconcileBtn.disabled = false;
      confirmReconcileBtn.classList.replace("btn-secondary", "btn-success");
      confirmReconcileBtn.innerHTML = "Confirm & Process";
    }
  }

  function showSuccessState(response) {
    reviewState.classList.add("d-none");
    successState.classList.remove("d-none");
    confirmReconcileBtn.classList.add("d-none");
    reconcileBackBtn.classList.add("d-none");
    reconcileCancelBtn.innerText = "Close";
    modalTitle.innerText = "Reconciliation Result";

    const stats = response.stats || {
      reconciled: response.reconciled || 0,
      failed: response.failed || 0,
      alreadyPaid: 0,
      totalProcessed: response.reconciled || 0,
      totalAmount: 0,
    };

    const successRate =
      stats.totalProcessed > 0
        ? ((stats.reconciled / stats.totalProcessed) * 100).toFixed(1)
        : 0;

    successSummary.innerHTML = `
        <div class="text-center mb-4">
            <i class="fas fa-check-circle text-success" style="font-size: 3.5rem;"></i>
            <h5 class="mt-3 mb-1">Reconciliation Complete</h5>
            <p class="text-muted small mb-0">${response.message}</p>
        </div>

        <!-- Stats Grid -->
        <div class="row g-3 mb-4">
            <div class="col-6">
                <div class="card border-success">
                    <div class="card-body text-center py-3">
                        <div class="text-success mb-1"><i class="fas fa-check-circle"></i></div>
                        <div class="h3 mb-0 text-success">${stats.reconciled}</div>
                        <div class="small text-muted">Reconciled</div>
                    </div>
                </div>
            </div>

            <div class="col-6">
                <div class="card border-danger">
                    <div class="card-body text-center py-3">
                        <div class="text-danger mb-1"><i class="fas fa-times-circle"></i></div>
                        <div class="h3 mb-0 text-danger">${stats.failed}</div>
                        <div class="small text-muted">Failed</div>
                    </div>
                </div>
            </div>

            ${
              stats.alreadyPaid > 0
                ? `
            <div class="col-6">
                <div class="card border-warning">
                    <div class="card-body text-center py-3">
                        <div class="text-warning mb-1"><i class="fas fa-forward"></i></div>
                        <div class="h3 mb-0 text-warning">${stats.alreadyPaid}</div>
                        <div class="small text-muted">Already Paid</div>
                    </div>
                </div>
            </div>
            `
                : ""
            }

            <div class="col-${stats.alreadyPaid > 0 ? "6" : "12"}">
                <div class="card border-primary">
                    <div class="card-body text-center py-3">
                        <div class="text-primary mb-1"><i class="fas fa-list"></i></div>
                        <div class="h3 mb-0 text-primary">${stats.totalProcessed}</div>
                        <div class="small text-muted">Total Processed</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Amount (if available) -->
        ${
          stats.totalAmount > 0
            ? `
        <div class="alert alert-success border-0 text-center mb-4">
            <div class="small text-muted mb-1">Total Amount Reconciled</div>
            <div class="h4 mb-0 text-success"><i class="fas fa-money-bill-wave me-2"></i>${stats.totalAmount.toLocaleString()} ETB</div>
        </div>
        `
            : ""
        }

        <!-- Success Rate -->
        <div class="mb-4">
            <div class="d-flex justify-content-between small mb-2">
                <span class="text-muted">Success Rate</span>
                <span class="fw-bold text-${successRate >= 90 ? "success" : successRate >= 70 ? "warning" : "danger"}">${successRate}%</span>
            </div>
            <div class="progress" style="height: 10px;">
                <div class="progress-bar bg-${successRate >= 90 ? "success" : successRate >= 70 ? "warning" : "danger"}" 
                     style="width: ${successRate}%" 
                     role="progressbar" 
                     aria-valuenow="${successRate}" 
                     aria-valuemin="0" 
                     aria-valuemax="100"></div>
            </div>
        </div>

        <!-- Info Notice -->
        <div class="alert alert-light border text-center mb-0">
            <i class="fas fa-info-circle text-primary me-2"></i>
            <small>All reconciled payments are now marked as 'Paid' in the system</small>
        </div>
    `;
  }

  if (reconcileBackBtn) {
    reconcileBackBtn.addEventListener("click", () => {
      importState.classList.remove("d-none");
      reviewState.classList.add("d-none");
      startReconcileBtn.classList.remove("d-none");
      confirmReconcileBtn.classList.add("d-none");
      reconcileBackBtn.classList.add("d-none");
      modalTitle.innerText = "Reconcile with Receipt";
    });
  }

  if (confirmReconcileBtn) {
    confirmReconcileBtn.addEventListener("click", async () => {
      if (!currentTempFile) return;
      clearReconcileError();

      confirmReconcileBtn.disabled = true;
      confirmReconcileBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

      try {
        const response = await api.post("/payments/reconcile/process", {
          fileName: currentTempFile,
        });

        if (response.success) {
          await loadPendingPayments(1);
          showSuccessState(response);
        } else {
          showReconcileError(response.message || "Processing failed");
        }
      } catch (error) {
        console.error("Processing error:", error);
        showReconcileError(
          error.message || "Failed to process reconciliation.",
        );
      } finally {
        confirmReconcileBtn.disabled = false;
        confirmReconcileBtn.innerHTML = "Confirm & Process";
      }
    });
  }

  function updateBadges(counts) {
    const pendingBadge = document.getElementById("pendingCountBadge");
    const processingBadge = document.getElementById("processingCountBadge");
    const verificationBadge = document.getElementById("verificationCountBadge");

    if (counts.pending > 0) {
      pendingBadge.textContent = counts.pending;
      pendingBadge.classList.remove("d-none");
    } else {
      pendingBadge.classList.add("d-none");
    }

    if (counts.processing > 0) {
      processingBadge.textContent = counts.processing;
      processingBadge.classList.remove("d-none");
    } else {
      processingBadge.classList.add("d-none");
    }

    if (verificationBadge) {
      if (counts.verification_needed > 0) {
        verificationBadge.textContent = counts.verification_needed;
        verificationBadge.classList.remove("d-none");
      } else {
        verificationBadge.classList.add("d-none");
      }
    }
  }

  async function loadExportHistory(page = 1) {
    try {
      const params = new URLSearchParams({ page, limit: currentLimit });
      const response = await api.get(`/payments/batches?${params.toString()}`);

      const batches = response.batches || [];
      const pagination = response.pagination || { page: 1, total_pages: 1 };

      renderBatchTable(batches);
      renderPagination(pagination);
      currentPage = page;
    } catch (error) {
      console.error("Error loading export history:", error);
      tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center py-5 text-danger">Failed to load history.</td></tr>';
    }
  }

  function renderBatchTable(batches) {
    const user = auth.getUser();
    const canDownload = user && user.role !== "auditor";

    const thead = document.querySelector("#pendingTable thead");
    thead.innerHTML = `
      <tr>
        <th class="px-4 py-3">Date</th>
        <th class="py-3">Batch ID</th>
        <th class="py-3 text-center">Drivers</th>
        <th class="py-3 text-end">Total Amount</th>
        <th class="py-3 text-center">Status</th>
        <th class="py-3">Exported By</th>
        <th class="py-3 text-center px-4">Action</th>
      </tr>
    `;

    if (batches.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center py-5 text-muted">No export history yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = batches
      .map(
        (batch) => `
      <tr>
          <script>console.log("Batch Render:", ${JSON.stringify(
            batch,
          )});</script>
        <td class="px-4 py-3 small text-muted">${new Date(
          batch.exported_at,
        ).toLocaleString()}</td>
        <td class="py-3 fw-bold">${batch.batch_id}</td>
        <td class="py-3 text-center">${batch.driver_count}</td>
        <td class="py-3 text-end fw-bold">${parseFloat(
          batch.total_amount,
        ).toLocaleString()} ETB</td>
        <td class="py-3 text-center">
          <span class="badge ${
            batch.paid_count === batch.payment_count
              ? "bg-success"
              : batch.paid_count > 0
                ? "bg-warning"
                : "bg-secondary"
          } bg-opacity-10 ${
            batch.paid_count === batch.num_payments
              ? "text-success"
              : batch.paid_count > 0
                ? "text-warning"
                : "text-muted"
          } rounded-pill px-3">
            ${batch.paid_count || 0}/${batch.num_payments || 0} Paid
          </span>
        </td>
        <td class="py-3 small text-muted">${
          batch.exported_by_name || "System"
        }</td>
        <td class="py-3 text-center px-4">
          ${
            canDownload
              ? `
          <button onclick="window.downloadBatch('${batch.batch_id}')" class="btn btn-sm btn-outline-success rounded-pill px-3">
            <i class="fas fa-download me-1"></i> Re-download
          </button>`
              : `<span class="text-muted small" title="Restricted"><i class="fas fa-lock"></i></span>`
          }
        </td>
      </tr>
    `,
      )
      .join("");
  }

  window.downloadBatch = async (batchId) => {
    try {
      const response = await fetch(
        `/api/payments/batches/${batchId}/download`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to download batch");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Batch_${batchId.replace(/-/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download the batch file. Please try again.");
    }
  };

  // Initialize
  updateButtonVisibility();
  loadPendingPayments();
});
