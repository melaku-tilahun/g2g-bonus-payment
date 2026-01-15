// Advanced Search JavaScript Module

document.addEventListener("DOMContentLoaded", () => {
  // Permission Check
  const user = auth.getUser();
  if (
    !user ||
    !["admin", "director", "manager", "auditor"].includes(user.role)
  ) {
    window.location.href = "/";
    return;
  }

  updateSearchFields();
  loadUsers();
  loadSavedSearches();
});

function updateSearchFields() {
  const type = document.getElementById("searchType").value;
  document
    .querySelectorAll(".search-fields")
    .forEach((el) => (el.style.display = "none"));
  document.getElementById(`${type}Fields`).style.display = "block";
}

async function loadUsers() {
  try {
    const users = await api.get("/users"); // Assuming this returns all users
    const auditSelect = document.getElementById("auditUserId");
    const importSelect = document.getElementById("importUserId");

    if (users && users.length > 0) {
      users.forEach((user) => {
        const opt = new Option(user.full_name, user.id);
        auditSelect.add(opt.cloneNode(true));
        importSelect.add(opt.cloneNode(true));
      });
    }
  } catch (e) {
    console.error("Load users error:", e);
  }
}

async function performSearch(page = 1) {
  const type = document.getElementById("searchType").value;
  const filters = getFilters(type);
  filters.page = page;

  ui.showLoading(true);
  try {
    const data = await api.post("/search/advanced", {
      search_type: type,
      filters,
    });
    if (data.success) {
      renderResults(data);
      document.getElementById(
        "resultsCount"
      ).textContent = `${data.total} results found`;
    }
  } catch (error) {
    console.error("Search error:", error);
    ui.toast("Search failed", "error");
  } finally {
    ui.showLoading(false);
  }
}

function getFilters(type) {
  const filters = {};
  if (type === "driver") {
    filters.name = document.getElementById("driverName").value;
    filters.driver_id = document.getElementById("driverId").value;
    filters.phone = document.getElementById("driverPhone").value;
    filters.tin = document.getElementById("driverTin").value;
    filters.verified = document.getElementById("driverVerified").value;
  } else if (type === "payment") {
    filters.driver_name = document.getElementById("paymentDriverName").value;
    filters.driver_id = document.getElementById("paymentDriverId").value;
    filters.status = document.getElementById("paymentStatus").value;
    filters.payment_method = document.getElementById("paymentMethod").value;
    filters.start_date = document.getElementById("paymentStartDate").value;
    filters.end_date = document.getElementById("paymentEndDate").value;
    filters.min_amount = document.getElementById("paymentMinAmount").value;
    filters.max_amount = document.getElementById("paymentMaxAmount").value;
  } else if (type === "audit") {
    filters.user_id = document.getElementById("auditUserId").value;
    filters.action = document.getElementById("auditAction").value;
    filters.entity_type = document.getElementById("auditEntityType").value;
    filters.start_date = document.getElementById("auditStartDate").value;
    filters.end_date = document.getElementById("auditEndDate").value;
  } else if (type === "import") {
    filters.imported_by = document.getElementById("importUserId").value;
    filters.start_date = document.getElementById("importStartDate").value;
    filters.end_date = document.getElementById("importEndDate").value;
  }
  return filters;
}

function renderResults(data) {
  const container = document.getElementById("searchResults");
  const type = data.search_type;
  const results = data.results;

  if (!results || results.length === 0) {
    container.innerHTML =
      '<div class="p-5 text-center text-muted">No results found for your criteria</div>';
    return;
  }

  let html = `
        <table class="table table-hover align-middle mb-0">
            <thead class="bg-light">
                <tr>
                    ${getHeader(type)}
                </tr>
            </thead>
            <tbody>
    `;

  results.forEach((row) => {
    html += `<tr>${getRow(type, row)}</tr>`;
  });

  html += "</tbody></table>";

  // Add Pagination if total > limit
  if (data.total > data.limit) {
    html += renderPagination(data);
  }

  container.innerHTML = html;
}

function getHeader(type) {
  if (type === "driver") {
    return "<th>Driver</th><th>TIN</th><th>Verified</th><th>Phone</th><th>Total Bonuses</th>";
  } else if (type === "payment") {
    return "<th>Driver</th><th>Amount</th><th>Date</th><th>Status</th><th>Method</th>";
  } else if (type === "audit") {
    return "<th>User</th><th>Action</th><th>Entity</th><th>Date</th>";
  } else if (type === "import") {
    return "<th>Batch ID</th><th>Date</th><th>Status</th><th>By</th>";
  }
}

function getRow(type, row) {
  if (type === "driver") {
    return `
            <td>
                <div class="fw-bold"><a href="/pages/driver-detail?id=${
                  row.driver_id
                }">${row.full_name}</a></div>
                <div class="small text-muted">${row.driver_id}</div>
            </td>
            <td>${row.tin || "-"}</td>
            <td><span class="badge ${
              row.verified ? "bg-success" : "bg-warning"
            }">${row.verified ? "YES" : "NO"}</span></td>
            <td>${row.phone_number}</td>
            <td class="fw-bold">${parseFloat(
              row.total_bonuses || 0
            ).toLocaleString()} ETB</td>
        `;
  } else if (type === "payment") {
    return `
            <td>
                <div class="fw-bold">${row.driver_name}</div>
                <div class="small text-muted">${row.driver_id}</div>
            </td>
            <td class="fw-bold text-primary">${parseFloat(
              row.total_amount
            ).toLocaleString()} ETB</td>
            <td>${new Date(row.payment_date).toLocaleDateString()}</td>
            <td><span class="badge ${
              row.status === "paid" ? "bg-success" : "bg-info"
            }">${row.status.toUpperCase()}</span></td>
            <td>${row.payment_method}</td>
        `;
  } else if (type === "audit") {
    return `
            <td>${row.user_name}</td>
            <td>${row.action}</td>
            <td>${row.entity_type} (#${row.entity_id})</td>
            <td>${new Date(row.created_at).toLocaleString()}</td>
        `;
  } else if (type === "import") {
    return `
            <td>${row.filename || "Batch Import"}</td>
            <td>${new Date(row.imported_at).toLocaleString()}</td>
            <td><span class="badge bg-success">${row.status}</span></td>
            <td>${row.imported_by_name}</td>
        `;
  }
}

function renderPagination(data) {
  const totalPages = Math.ceil(data.total / data.limit);
  let html =
    '<div class="p-3 border-top d-flex justify-content-center"><nav><ul class="pagination pagination-sm mb-0">';
  for (let i = 1; i <= totalPages; i++) {
    html += `<li class="page-item ${
      i === data.page ? "active" : ""
    }"><a class="page-link" href="#" onclick="performSearch(${i})">${i}</a></li>`;
  }
  html += "</ul></nav></div>";
  return html;
}

function clearFilters() {
  document.querySelectorAll("input, select").forEach((el) => {
    if (el.id !== "searchType") el.value = "";
  });
}

function saveCurrentSearch() {
  const name = prompt("Enter a name for this search:");
  if (!name) return;

  confirmSaveSearch(name);
}

async function confirmSaveSearch(name) {
  const type = document.getElementById("searchType").value;
  const filters = getFilters(type);

  try {
    const data = await api.post("/search/save", {
      name,
      search_type: type,
      filters,
    });
    if (data.success) {
      ui.toast("Search saved!", "success");
      loadSavedSearches();
    }
  } catch (e) {
    ui.toast("Failed to save search", "error");
  }
}

async function loadSavedSearches() {
  const container = document.getElementById("savedSearchesList");
  try {
    const data = await api.get("/search/saved");
    if (data.success && data.searches.length > 0) {
      let html = '<div class="d-flex flex-wrap gap-2">';
      data.searches.forEach((s) => {
        html += `
                    <div class="badge bg-light text-dark border p-2 d-flex align-items-center">
                        <span class="me-2 cursor-pointer" onclick="executeSavedSearch(${s.id})">${s.name} (${s.search_type})</span>
                        <i class="fas fa-times text-danger cursor-pointer" onclick="deleteSavedSearch(${s.id})"></i>
                    </div>
                `;
      });
      html += "</div>";
      container.innerHTML = html;
    } else {
      container.innerHTML =
        '<p class="text-muted small mb-0">No saved searches yet</p>';
    }
  } catch (e) {
    console.error("Load saved searches error:", e);
  }
}

async function deleteSavedSearch(id) {
  if (!confirm("Delete this saved search?")) return;
  try {
    const data = await api.delete(`/search/saved/${id}`);
    if (data.success) {
      loadSavedSearches();
    }
  } catch (e) {
    ui.toast("Failed to delete search", "error");
  }
}

async function executeSavedSearch(id) {
  ui.showLoading(true);
  try {
    const data = await api.post(`/search/execute/${id}`);
    if (data.success) {
      // Update UI fields based on filters? For now just show results
      document.getElementById("searchType").value = data.search_type;
      updateSearchFields();
      renderResults(data);
      document.getElementById(
        "resultsCount"
      ).textContent = `${data.total} results found`;
    }
  } catch (e) {
    ui.toast("Failed to execute search", "error");
  } finally {
    ui.showLoading(false);
  }
}
