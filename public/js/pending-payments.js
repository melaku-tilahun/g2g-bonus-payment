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
      const counts = response.counts || { pending: 0, processing: 0 };

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

    thead.innerHTML = `
      <tr>
          <th class="px-4 py-3">#</th>
          <th class="py-3">Driver</th>
          <th class="py-3">Driver ID</th>
          ${isProcessingTab ? '<th class="py-3">Batch</th>' : ""}
          <th class="py-3 text-center">Pending Weeks</th>
          <th class="py-3">Period</th>
          <th class="py-3 text-end">Total Amount</th>
          <th class="py-3 text-center px-4">Action</th>
      </tr>
    `;

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
        return `
            <tr>
                <td class="px-4 text-muted small">${rowNumber}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="fw-bold text-dark">${item.full_name}</div>
                        ${
                          isExported
                            ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 x-small">Exported</span>'
                            : '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 x-small">Pending</span>'
                        }
                    </div>
                    <div class="small text-muted">${
                      item.phone_number || "No phone"
                    }</div>
                </td>
                <td><span class="badge bg-light text-dark font-monospace">${
                  item.driver_id
                }</span></td>
                ${
                  isProcessingTab
                    ? `<td class="small text-muted font-monospace">${
                        item.batch_id || "N/A"
                      }</td>`
                    : ""
                }
                <td class="text-center">
                    <span class="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3">
                        ${item.pending_weeks} Weeks
                    </span>
                </td>
                <td class="small">
                    <div>From: ${new Date(
                      item.earliest_bonus_date
                    ).toLocaleDateString()}</div>
                    <div>To: ${new Date(
                      item.latest_bonus_date
                    ).toLocaleDateString()}</div>
                </td>
                <td class="text-end fw-bold text-dark">
                    ${parseFloat(
                      item.total_pending_amount
                    ).toLocaleString()} <span class="small text-muted fw-normal">ETB</span>
                </td>
                <td class="text-center px-4">
                    <a href="/pages/driver-detail.html?id=${
                      item.driver_id
                    }" class="btn btn-sm btn-outline-primary rounded-pill px-3">
                        View Details
                    </a>
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
          formData
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
          error.message || "Failed to validate reconciliation file."
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
      amountMismatches: [],
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
    `
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
        summary.amountMismatches && summary.amountMismatches.length > 0
          ? `
        <div class="mt-4">
            <div class="label text-danger mb-2 font-weight-bold">Amount Discrepancy Found</div>
            <div class="table-responsive">
                <table class="table table-sm table-bordered mb-0 small">
                    <thead class="bg-light">
                        <tr>
                            <th>Phone</th>
                            <th>Report Amt</th>
                            <th>Internal Amt</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.amountMismatches
                          .map(
                            (m) => `
                            <tr>
                                <td>${m.phone}</td>
                                <td class="text-danger">${m.fileAmount.toLocaleString()}</td>
                                <td class="text-success">${m.dbAmount.toLocaleString()}</td>
                            </tr>
                        `
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
        summary.unmatchedPhones.length > 0 && isSuccess
          ? `
        <div class="mt-3 small text-danger">
          <div class="label mb-1">Unmatched Phones:</div>
          <div class="bg-white p-2 rounded border small">${summary.unmatchedPhones.join(
            ", "
          )}</div>
        </div>
      `
          : ""
      }
    `;

    // 3. Handle Failure State
    if (!isSuccess) {
      confirmReconcileBtn.disabled = true;
      confirmReconcileBtn.classList.replace("btn-success", "btn-secondary");
      confirmReconcileBtn.innerHTML =
        '<i class="fas fa-times me-2"></i> Cannot Process';
      summaryContainer.innerHTML += `
        <div class="alert alert-danger border-0 rounded-3 mt-3 mb-0 small">
            <i class="fas fa-exclamation-triangle me-2"></i> 
            ${errorMessage}
        </div>
      `;
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

    successSummary.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <span class="text-muted small">Reconciled Payments</span>
            <span class="fw-bold text-success">${response.success}</span>
        </div>
        <div class="d-flex justify-content-between">
            <span class="text-muted small">Status</span>
            <span class="badge bg-success bg-opacity-10 text-success">Completed</span>
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
          error.message || "Failed to process reconciliation."
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
            batch
          )});</script>
        <td class="px-4 py-3 small text-muted">${new Date(
          batch.exported_at
        ).toLocaleString()}</td>
        <td class="py-3 fw-bold">${batch.batch_id}</td>
        <td class="py-3 text-center">${batch.driver_count}</td>
        <td class="py-3 text-end fw-bold">${parseFloat(
          batch.total_amount
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
    `
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
        }
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
