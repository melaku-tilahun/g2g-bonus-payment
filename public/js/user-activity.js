// User Activity JavaScript Module

let currentPage = 1;
const limit = 50;

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  // Set default dates (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  document.getElementById("endDate").valueAsDate = endDate;
  document.getElementById("startDate").valueAsDate = startDate;

  // Load users for filter
  await loadUsers();

  // Load initial data
  await loadUserSummary();
  await loadActivityReport();
});

async function loadUsers() {
  try {
    const users = await api.get("/users");
    const select = document.getElementById("filterUser");

    users.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = `${user.full_name} (${user.email})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Load users error:", error);
  }
}

async function loadUserSummary() {
  try {
    const data = await api.get("/audit/user-summary?period=month");

    if (data.success && data.summary) {
      displayUserSummary(data.summary);
    }
  } catch (error) {
    console.error("Load user summary error:", error);
  }
}

async function loadActivityReport() {
  try {
    const userId = document.getElementById("filterUser").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    const params = new URLSearchParams({ page: currentPage, limit });
    if (userId) params.append("user_id", userId);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const data = await api.get(`/audit/activity-report?${params.toString()}`);

    if (data.success) {
      displayActivityLogs(data.logs);
      updatePagination(data.page, data.total, data.limit);
    }
  } catch (error) {
    console.error("Load activity report error:", error);
    document.getElementById("activityLogsTableBody").innerHTML =
      '<tr><td colspan="5" class="text-center text-danger">Failed to load activity logs</td></tr>';
  }
}

async function loadSecurityEvents() {
  try {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const data = await api.get(`/audit/security-events?${params.toString()}`);

    if (data.success) {
      displaySecurityEvents(data.events, data.summary);
    }
  } catch (error) {
    console.error("Load security events error:", error);
  }
}

function displayUserSummary(summary) {
  const container = document.getElementById("userSummaryTable");

  if (!summary || summary.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">No activity data available</p>';
    return;
  }

  let html = '<div class="table-responsive"><table class="table table-hover">';
  html += `<thead><tr>
        <th>User</th>
        <th>Total Actions</th>
        <th>Verifications</th>
        <th>Imports</th>
        <th>Exports</th>
        <th>Reconciliations</th>
    </tr></thead><tbody>`;

  summary.forEach((user) => {
    html += `<tr>
            <td>
                <strong>${user.full_name}</strong><br>
                <small class="text-muted">${user.email}</small>
            </td>
            <td class="fw-bold">${user.total_actions || 0}</td>
            <td>${user.verifications || 0}</td>
            <td>${user.imports || 0}</td>
            <td>${user.exports || 0}</td>
            <td>${user.reconciliations || 0}</td>
        </tr>`;
  });

  html += "</tbody></table></div>";
  container.innerHTML = html;
}

function displayActivityLogs(logs) {
  const tbody = document.getElementById("activityLogsTableBody");

  if (!logs || logs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center py-5 text-muted">No activity logs found</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  logs.forEach((log) => {
    const row = document.createElement("tr");
    const timestamp = new Date(log.created_at).toLocaleString();
    const details = log.details
      ? typeof log.details === "string"
        ? log.details
        : JSON.stringify(log.details)
      : "-";

    row.innerHTML = `
            <td class="small">${timestamp}</td>
            <td>
                <strong>${log.user_name || "Unknown"}</strong><br>
                <small class="text-muted">${log.user_email || ""}</small>
            </td>
            <td><span class="badge bg-primary">${log.action}</span></td>
            <td>
                <small>
                    ${log.entity_type || "-"}<br>
                    ${
                      log.entity_id
                        ? `<span class="text-muted">${log.entity_id.substring(
                            0,
                            12
                          )}...</span>`
                        : ""
                    }
                </small>
            </td>
            <td><small class="text-muted">${details.substring(0, 50)}${
      details.length > 50 ? "..." : ""
    }</small></td>
        `;

    tbody.appendChild(row);
  });
}

function displaySecurityEvents(events, summary) {
  const container = document.getElementById("securityEventsContainer");

  if (!events || events.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">No security events found</p>';
    return;
  }

  let html = '<div class="mb-4">';
  html += '<h6 class="fw-bold mb-3">Event Summary</h6>';
  html += '<div class="row g-3">';

  summary.forEach((s) => {
    html += `<div class="col-md-4">
            <div class="card border">
                <div class="card-body">
                    <div class="text-muted small">${s.action}</div>
                    <div class="h4 mb-0">${s.count}</div>
                </div>
            </div>
        </div>`;
  });

  html += "</div></div>";

  html += '<h6 class="fw-bold mb-3">Recent Events</h6>';
  html += '<div class="table-responsive"><table class="table table-hover">';
  html +=
    "<thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>";

  events.forEach((event) => {
    const timestamp = new Date(event.created_at).toLocaleString();
    html += `<tr>
            <td class="small">${timestamp}</td>
            <td>${event.user_name || "Unknown"}</td>
            <td><span class="badge bg-danger">${event.action}</span></td>
            <td><small>${event.details || "-"}</small></td>
        </tr>`;
  });

  html += "</tbody></table></div>";
  container.innerHTML = html;
}

function updatePagination(page, total, itemsPerPage) {
  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, total);

  document.getElementById(
    "activityPaginationInfo"
  ).textContent = `Showing ${start}-${end} of ${total}`;

  document
    .getElementById("prevActivityPage")
    .classList.toggle("disabled", page <= 1);
  document
    .getElementById("nextActivityPage")
    .classList.toggle("disabled", end >= total);
}

function changePage(delta) {
  currentPage += delta;
  if (currentPage < 1) currentPage = 1;
  loadActivityReport();
}

// Load security events when tab is shown
document.getElementById("security-tab").addEventListener("shown.bs.tab", () => {
  loadSecurityEvents();
});
