document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("uploadForm");
  const excelFile = document.getElementById("excelFile");
  const dropZone = document.getElementById("dropZone");
  const uploadBtn = document.getElementById("uploadBtn");
  const checklistItems = document.querySelectorAll(
    "#validationChecklist .list-group-item"
  );

  // Drag and Drop
  dropZone.onclick = () => excelFile.click();
  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add("border-primary");
  };
  dropZone.ondragleave = () => dropZone.classList.remove("border-primary");
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-primary");
    if (e.dataTransfer.files.length) {
      excelFile.files = e.dataTransfer.files;
      handleFileSelect();
    }
  };

  excelFile.onchange = handleFileSelect;

  async function handleFileSelect() {
    const file = excelFile.files[0];
    if (!file) return;

    document.getElementById("fileSelectionInfo").classList.remove("d-none");
    document.getElementById("selectedFileName").textContent = file.name;
    document.getElementById("selectedFileSize").textContent = `${(
      file.size /
      (1024 * 1024)
    ).toFixed(2)} MB`;
    dropZone.classList.add("d-none");

    // Start Auto-Validation
    validateFile(file);
  }

  async function validateFile(file) {
    // Reset checklist
    checklistItems.forEach((item) => {
      item.classList.add("opacity-50");
      item.querySelector("i").className = "far fa-circle text-muted";
    });

    const updateItem = (name, status) => {
      const item = Array.from(checklistItems).find(
        (i) => i.dataset.item === name
      );
      if (!item) return;
      item.classList.remove("opacity-50");
      item.querySelector("i").className = status
        ? "fas fa-check-circle text-success"
        : "fas fa-times-circle text-danger";
    };

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Fetch validation from backend
      const response = await api.post("/uploads/validate", formData);
      const stats = response.validation_results;

      updateItem("readable", stats.file_readable);
      updateItem("sheet", stats.single_sheet);
      updateItem("columns", stats.columns_valid);
      updateItem("data", stats.has_data);
      updateItem("date", stats.date_consistent);

      if (response.ready_for_import) {
        // Show File Analysis
        document.getElementById("fileAnalysis").classList.remove("d-none");

        // Format detected date nicely
        const rawDate = stats.detected_date;
        const dateObj = new Date(rawDate);
        const formattedDate = !isNaN(dateObj)
          ? dateObj.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : rawDate;

        document.getElementById("detectedDateDisplay").textContent =
          formattedDate;

        uploadBtn.disabled = false;
        ui.toast("File validated successfully!", "success");
      } else {
        uploadBtn.disabled = true;
        let msg = "Validation failed.";
        if (stats.suggestions && stats.suggestions.length > 0) {
          msg += " " + stats.suggestions[0];
        } else if (!stats.detected_date) {
          msg += " Could not detect a valid date in the file.";
        }
        ui.toast(msg, "error");
      }
    } catch (error) {
      console.error(error);
      ui.toast("Error validating file", "error");
    }
  }

  uploadForm.onsubmit = async (e) => {
    e.preventDefault();
    const file = excelFile.files[0];

    if (!file) return;

    try {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span> Processing...';

      const formData = new FormData();
      formData.append("file", file);

      // Progress Bar simulation (real progress requires XHR)
      const result = await api.post("/uploads/excel", formData);

      // Check if phone mismatch warnings require confirmation
      if (result.requires_confirmation && result.warnings) {
        const confirmed = await showPhoneMismatchConfirmation(result.warnings);

        if (confirmed) {
          // Re-submit with confirmation flag
          uploadBtn.innerHTML =
            '<span class="spinner-border spinner-border-sm me-2"></span> Confirming...';

          const confirmFormData = new FormData();
          confirmFormData.append("file", file);
          confirmFormData.append("confirm_warnings", "true");

          const confirmedResult = await api.post(
            "/uploads/excel",
            confirmFormData
          );
          showResults(confirmedResult);
        } else {
          // User cancelled
          uploadBtn.disabled = false;
          uploadBtn.innerHTML =
            '<i class="fas fa-cloud-upload-alt me-2"></i> Start Import Process';
          ui.toast("Import cancelled by user", "info");
        }
      } else {
        showResults(result);
      }
    } catch (error) {
      ui.toast(error.message || "Upload failed", "error");
      uploadBtn.disabled = false;
      uploadBtn.innerHTML =
        '<i class="fas fa-cloud-upload-alt me-2"></i> Start Import Process';
    }
  };

  async function showPhoneMismatchConfirmation(warnings) {
    return new Promise((resolve) => {
      const warningList = warnings
        .map(
          (w) =>
            `<tr>
          <td class="small">${w.driver_id}</td>
          <td class="small"><span class="badge bg-light text-dark border">${w.db_phone}</span></td>
          <td class="small"><span class="badge bg-warning bg-opacity-10 text-warning border border-warning">${w.excel_phone}</span></td>
        </tr>`
        )
        .join("");

      const modalHtml = `
        <div class="modal fade" id="phoneMismatchModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content border-0 rounded-4">
              <div class="modal-header border-0 bg-warning bg-opacity-10">
                <h5 class="modal-title fw-bold">
                  <i class="fas fa-exclamation-triangle text-warning me-2"></i>
                  Phone Number Mismatches Detected
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <p class="text-muted mb-3">
                  The following drivers have different phone numbers in the Excel file compared to the database. 
                  <strong>Proceeding will use the Excel phone numbers for payment.</strong>
                </p>
                <div class="table-responsive">
                  <table class="table table-sm table-hover">
                    <thead class="bg-light">
                      <tr>
                        <th>Driver ID</th>
                        <th>Database Phone</th>
                        <th>Excel Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${warningList}
                    </tbody>
                  </table>
                </div>
                <div class="alert alert-warning border-0 rounded-3 mb-0 mt-3">
                  <i class="fas fa-info-circle me-2"></i>
                  <strong>Review carefully:</strong> Payments will be sent to the Excel phone numbers. Update driver information if needed.
                </div>
              </div>
              <div class="modal-footer border-0">
                <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancel Import</button>
                <button type="button" id="confirmProceedBtn" class="btn btn-warning rounded-pill px-4">
                  <i class="fas fa-check me-2"></i>Proceed Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Remove existing modal if any
      const existingModal = document.getElementById("phoneMismatchModal");
      if (existingModal) existingModal.remove();

      // Add modal to body
      document.body.insertAdjacentHTML("beforeend", modalHtml);

      const modal = new bootstrap.Modal(
        document.getElementById("phoneMismatchModal")
      );

      document.getElementById("confirmProceedBtn").onclick = () => {
        modal.hide();
        resolve(true);
      };

      document.getElementById("phoneMismatchModal").addEventListener(
        "hidden.bs.modal",
        () => {
          document.getElementById("phoneMismatchModal").remove();
          resolve(false);
        },
        { once: true }
      );

      modal.show();
    });
  }

  function showResults(data) {
    document.querySelector(".row.g-4").classList.add("d-none");
    document.getElementById("importResults").classList.remove("d-none");

    // Logic to detect if it was a strict Blocking failure
    const isFailure =
      data.success === false ||
      (data.success_count === 0 && data.error_count > 0);

    if (isFailure) {
      // Update Icon and Text for Failure
      const iconDiv = document.getElementById("resultIcon");
      iconDiv.className =
        "bg-danger text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-lg";
      iconDiv.innerHTML = '<i class="fas fa-times"></i>';

      document.getElementById("resultTitle").textContent =
        "Import Blocked / Failed";
      document.getElementById("resultTitle").className =
        "h3 fw-bold text-danger";
      document.getElementById("resultSubtitle").textContent =
        data.message || "Strict validation rules prevented this import.";
    } else {
      // Success State
      const iconDiv = document.getElementById("resultIcon");
      iconDiv.className =
        "bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-lg";
      iconDiv.innerHTML = '<i class="fas fa-check"></i>';

      document.getElementById("resultTitle").textContent =
        "Import Successfully Completed!";
      document.getElementById("resultTitle").className =
        "h3 fw-bold text-success";
      document.getElementById("resultSubtitle").textContent =
        "Details of the processed file are below.";
    }

    document.getElementById("resTotal").textContent = data.summary
      ? data.summary.total_records
      : data.total_records;
    document.getElementById("resSuccess").textContent = data.success_count;
    document.getElementById("resSkipped").textContent = data.skipped_count;
    document.getElementById("resErrors").textContent = data.error_count;

    if (data.errors && data.errors.length > 0) {
      document.getElementById("errorDetailsSection").classList.remove("d-none");
      const tbody = document.getElementById("errorTableBody");
      tbody.innerHTML = "";
      data.errors.forEach((err) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="small fw-bold">${err.row}</td><td class="small text-danger">${err.message}</td>`;
        tbody.appendChild(tr);
      });
    }
  }

  window.downloadReport = () => {
    const total = document.getElementById("resTotal").textContent;
    const success = document.getElementById("resSuccess").textContent;
    const skipped = document.getElementById("resSkipped").textContent;
    const errors = document.getElementById("resErrors").textContent;
    const fileName = document.getElementById("selectedFileName").textContent;

    const content = `Import Report - ${new Date().toLocaleString()}
File: ${fileName}
-----------------------------------
Total Records Found: ${total}
Successfully Imported: ${success}
Skipped (Verified): ${skipped}
Errors: ${errors}

Generated by G2G Bonus Tracking System
`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import_report_${new Date().getTime()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    ui.toast("Report downloaded", "success");
  };

  // Load History
  loadHistory();
});

async function loadHistory() {
  try {
    const history = await api.get("/uploads/history");
    const tbody = document.getElementById("historyTableBody");
    tbody.innerHTML = "";

    if (!history.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center py-4 text-muted">No upload history found</td></tr>';
      return;
    }

    history.forEach((h) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td class="ps-4">${new Date(
                  h.imported_at
                ).toLocaleDateString()}</td>
                <td class="fw-semibold">
                    ${
                      h.file_path
                        ? `<a href="/uploads/${h.file_path}" target="_blank" class="text-decoration-none"><i class="fas fa-download me-1"></i> ${h.file_name}</a>`
                        : h.file_name
                    }
                </td>
                <td>${new Date(h.week_date).toLocaleDateString()}</td>
                <td class="text-center"><span class="badge bg-light text-dark border">${
                  h.total_records
                }</span></td>
                <td class="text-center"><span class="badge bg-success bg-opacity-10 text-success">${
                  h.success_count
                }</span></td>
                <td class="text-center"><span class="badge bg-warning bg-opacity-10 text-warning">${
                  h.skipped_count
                }</span></td>
                <td class="text-center"><span class="badge bg-danger bg-opacity-10 text-danger">${
                  h.error_count
                }</span></td>
                <td><span class="small text-muted">${
                  h.imported_by_name || "Admin"
                }</span></td>
            `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
  }
}
