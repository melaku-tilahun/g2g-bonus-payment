// Batch Management JavaScript Module

let currentBatchId = null;

document.addEventListener("DOMContentLoaded", () => {
  // Permission Check
  const user = auth.getUser();
  if (!user || !["admin", "director", "manager"].includes(user.role)) {
    window.location.href = "/index.html";
    return;
  }

  loadBatches();
});

async function loadBatches(page = 1) {
  const status = document.getElementById("statusFilter").value;
  const container = document.getElementById("batchesTableContainer");

  try {
    const data = await api.get(`/batches?page=${page}&status=${status}`);
    if (data.success) {
      renderBatchesTable(data.batches);
      renderPagination(data.pagination);
    }
  } catch (error) {
    console.error("Load batches error:", error);
    ui.toast("Failed to load batches", "error");
  }
}

function renderBatchesTable(batches) {
  const container = document.getElementById("batchesTableContainer");

  if (!batches || batches.length === 0) {
    container.innerHTML =
      '<p class="text-center p-5 text-muted">No payment batches found</p>';
    return;
  }

  let html = `
        <table class="table table-hover align-middle mb-0">
            <thead class="bg-light">
                <tr>
                    <th class="ps-4">Batch ID</th>
                    <th>Status</th>
                    <th>Total Amount</th>
                    <th>Drivers</th>
                    <th>Exported At</th>
                    <th>Exported By</th>
                    <th class="text-end pe-4">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

  batches.forEach((batch) => {
    const statusClass =
      batch.status === "completed" ? "bg-success" : "bg-warning";
    html += `
            <tr>
                <td class="ps-4 fw-bold text-primary">${batch.batch_id}</td>
                <td>
                    <span class="badge ${statusClass}">${batch.status.toUpperCase()}</span>
                </td>
                <td class="fw-bold">${parseFloat(
                  batch.total_amount
                ).toLocaleString()} ETB</td>
                <td>${batch.driver_count}</td>
                <td>${new Date(batch.exported_at).toLocaleString()}</td>
                <td>${batch.exported_by_name || "System"}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-light btn-sm rounded-circle me-1" onclick="viewBatchDetails(${
                      batch.id
                    })">
                        <i class="fas fa-eye text-primary"></i>
                    </button>
                </td>
            </tr>
        `;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

async function viewBatchDetails(id) {
  currentBatchId = id;
  try {
    const data = await api.get(`/batches/${id}`);
    if (data.success) {
      const batch = data.batch;
      const payments = data.payments;

      document.getElementById("modalBatchId").textContent = batch.batch_id;
      document.getElementById("modalStatus").innerHTML = `<span class="badge ${
        batch.status === "completed" ? "bg-success" : "bg-warning"
      }">${batch.status.toUpperCase()}</span>`;
      document.getElementById("modalAmount").textContent = `${parseFloat(
        batch.total_amount
      ).toLocaleString()} ETB`;
      document.getElementById("modalCount").textContent = batch.driver_count;
      document.getElementById("modalDate").textContent = new Date(
        batch.exported_at
      ).toLocaleString();

      const tableBody = document.querySelector("#modalPaymentsTable tbody");
      tableBody.innerHTML = "";

      payments.forEach((p) => {
        tableBody.innerHTML += `
                    <tr>
                        <td>
                            <div class="fw-bold">${
                              p.driver_name || "Unknown"
                            }</div>
                            <div class="small text-muted">${p.driver_id}</div>
                        </td>
                        <td class="fw-bold">${parseFloat(
                          p.total_amount
                        ).toLocaleString()} ETB</td>
                        <td><span class="badge bg-light text-dark border">${p.status.toUpperCase()}</span></td>
                        <td>${p.processed_by || "System"}</td>
                    </tr>
                `;
      });

      // Show/Hide Confirm Button
      const confirmBtn = document.getElementById("confirmBatchBtn");
      const user = auth.getUser();
      const canPay = ["admin", "director"].includes(user.role);

      if (batch.status === "processing" && canPay) {
        confirmBtn.style.display = "block";
      } else {
        confirmBtn.style.display = "none";
      }

      const modal = new bootstrap.Modal(
        document.getElementById("batchDetailModal")
      );
      modal.show();
    }
  } catch (error) {
    console.error("View batch details error:", error);
    ui.toast("Failed to load batch details", "error");
  }
}

async function confirmBatch() {
  if (!currentBatchId) return;

  // Show Password Modal
  const passwordModal = new bootstrap.Modal(
    document.getElementById("passwordConfirmModal")
  );
  document.getElementById("confirmPasswordInput").value = "";
  document.getElementById("passwordError").classList.add("d-none");
  passwordModal.show();
}

async function executeBatchConfirmation() {
  if (!currentBatchId) return;

  const password = document.getElementById("confirmPasswordInput").value;
  if (!password) {
    document.getElementById("passwordError").textContent =
      "Password is required";
    document.getElementById("passwordError").classList.remove("d-none");
    return;
  }

  const confirmBtn = document.querySelector(
    "#passwordConfirmModal .btn-danger"
  );
  const originalText = confirmBtn.innerHTML;
  confirmBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
  confirmBtn.disabled = true;

  try {
    const data = await api.put(`/batches/${currentBatchId}/confirm`, {
      password,
    });
    if (data.success) {
      ui.toast(data.message, "success");

      // Close Modals
      bootstrap.Modal.getInstance(
        document.getElementById("passwordConfirmModal")
      ).hide();
      bootstrap.Modal.getInstance(
        document.getElementById("batchDetailModal")
      ).hide();

      loadBatches();
    }
  } catch (error) {
    console.error("Confirm batch error:", error);
    if (error.status === 401) {
      document.getElementById("passwordError").textContent =
        "Incorrect password";
      document.getElementById("passwordError").classList.remove("d-none");
    } else {
      ui.toast(error.message || "Failed to confirm batch", "error");
    }
  } finally {
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
  }
}

function renderPagination(pagination) {
  const container = document.getElementById("paginationContainer");
  if (pagination.total_pages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `<div>Showing page ${pagination.page} of ${pagination.total_pages}</div>`;
  html += '<nav><ul class="pagination pagination-sm mb-0">';

  for (let i = 1; i <= pagination.total_pages; i++) {
    html += `
            <li class="page-item ${i === pagination.page ? "active" : ""}">
                <a class="page-link" href="#" onclick="loadBatches(${i})">${i}</a>
            </li>
        `;
  }

  html += "</ul></nav>";
  container.innerHTML = html;
}
