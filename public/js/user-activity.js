// User Activity JavaScript Module

let currentPage = 1;
const limit = 50;

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  // Permission Check
  const user = auth.getUser();
  if (!user || !["admin", "director"].includes(user.role)) {
    window.location.href = "/";
    return;
  }

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
    const action = document.getElementById("filterAction").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    const params = new URLSearchParams({ page: currentPage, limit });
    if (userId) params.append("user_id", userId);
    if (action) params.append("action", action);
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
      '<tr><td colspan="5" class="text-center text-danger py-5">Failed to load activity logs</td></tr>';
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
      '<p class="text-muted text-center py-4">No activity data available for this period.</p>';
    return;
  }

  let html = '<table class="table table-excel table-hover mb-0 align-middle">';
  html += `<thead><tr>
        <th class="ps-4">Team Member</th>
        <th>Audit Count</th>
        <th>Verifications</th>
        <th>Imports</th>
        <th>Exports</th>
        <th class="pe-4">Reconciliations</th>
    </tr></thead><tbody>`;

  summary.forEach((user) => {
    const initials = user.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
    html += `<tr>
            <td class="ps-4">
                <div class="d-flex align-items-center">
                    <div class="avatar-user">${initials}</div>
                    <div>
                        <div class="fw-bold text-dark">${user.full_name}</div>
                        <div class="x-small text-muted">${user.email}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge bg-light text-primary border-0 fw-bold px-3">${
              user.total_actions || 0
            }</span></td>
            <td><span class="text-dark small">${
              user.verifications || 0
            }</span></td>
            <td><span class="text-dark small">${user.imports || 0}</span></td>
            <td><span class="text-dark small">${user.exports || 0}</span></td>
            <td class="pe-4"><span class="text-dark small">${
              user.reconciliations || 0
            }</span></td>
        </tr>`;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

function displayActivityLogs(logs) {
  const tbody = document.getElementById("activityLogsTableBody");

  if (!logs || logs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center py-5 text-muted">No activity logs found for the selected criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  logs.forEach((log) => {
    const row = document.createElement("tr");
    const date = new Date(log.created_at);
    const timestampHtml = `
        <div class="small">
            <div class="text-dark fw-semibold">${date.toLocaleDateString()}</div>
            <div class="text-muted x-small">${date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}</div>
        </div>
    `;

    const initials = log.user_name
      ? log.user_name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2)
      : "??";

    let detailsPreview = "-";
    let fullDetails = null;

    if (log.details) {
      try {
        const parsed =
          typeof log.details === "string"
            ? JSON.parse(log.details)
            : log.details;
        fullDetails = parsed;
        const str = JSON.stringify(parsed);
        detailsPreview = str.length > 40 ? str.substring(0, 40) + "..." : str;
      } catch (e) {
        detailsPreview = String(log.details);
      }
    }

    const actionClass = getActionBadgeClass(log.action);

    row.innerHTML = `
            <td class="ps-4">${timestampHtml}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-user small" style="width:28px; height:28px; font-size:11px;">${initials}</div>
                    <div class="small">
                        <div class="fw-bold text-dark">${
                          log.user_name || "System"
                        }</div>
                        <div class="x-small text-muted">${
                          log.user_email || ""
                        }</div>
                    </div>
                </div>
            </td>
            <td><span class="badge ${actionClass} rounded-pill px-3 py-1 log-badge">${
              log.action
            }</span></td>
            <td>
                <div class="small">
                    <div class="text-dark fw-semibold">${
                      log.entity_type || "-"
                    }</div>
                    <div class="x-small text-muted font-monospace">${
                      log.entity_id
                        ? log.entity_id.substring(0, 8) + "..."
                        : "-"
                    }</div>
                </div>
            </td>
            <td class="text-end pe-4">
                <div class="d-flex align-items-center justify-content-end">
                    <span class="x-small text-muted font-monospace me-2 text-truncate" style="max-width: 150px;">${detailsPreview}</span>
                    ${
                      fullDetails
                        ? `<button class="btn btn-sm btn-outline-brand border-0 rounded-circle" onclick='showLogDetails(${JSON.stringify(
                            fullDetails,
                          ).replace(/'/g, "&apos;")}, "${
                            log.entity_type || ""
                          }", "${log.entity_id || ""}", "${
                            log.user_name || "Unknown"
                          }", "${date.toLocaleString()}")' title="View Deep Audit">
                            <i class="fas fa-search-plus"></i></button>`
                        : ""
                    }
                </div>
            </td>
        `;

    tbody.appendChild(row);
  });
}

function getActionBadgeClass(action) {
  const a = action.toLowerCase();
  if (a.includes("create") || a.includes("add") || a.includes("import"))
    return "bg-success bg-opacity-10 text-success";
  if (a.includes("update") || a.includes("edit"))
    return "bg-primary bg-opacity-10 text-primary";
  if (a.includes("delete") || a.includes("remove") || a.includes("block"))
    return "bg-danger bg-opacity-10 text-danger";
  if (a.includes("export") || a.includes("download"))
    return "bg-info bg-opacity-10 text-info";
  if (a.includes("confirm") || a.includes("verify"))
    return "bg-brand bg-opacity-10 text-brand";
  return "bg-secondary bg-opacity-10 text-secondary";
}

window.showLogDetails = function (
  details,
  entityType,
  entityId,
  userName,
  timestamp,
) {
  const metaContainer = document.getElementById("logDetailsMetadata");
  const contentContainer = document.getElementById("logDetailsContent");

  metaContainer.innerHTML = `
    <div class="row g-3">
        <div class="col-md-6">
            <div class="p-3 bg-light rounded-3">
                <div class="x-small text-muted fw-bold text-uppercase mb-1">Executor</div>
                <div class="fw-bold text-dark">${userName || "System"}</div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="p-3 bg-light rounded-3">
                <div class="x-small text-muted fw-bold text-uppercase mb-1">Exact Timestamp</div>
                <div class="fw-bold text-dark">${timestamp}</div>
            </div>
        </div>
        ${
          entityType
            ? `
        <div class="col-md-6">
            <div class="p-3 bg-light rounded-3 border-start border-4 border-primary">
                <div class="x-small text-muted fw-bold text-uppercase mb-1">Target Entity</div>
                <div class="fw-bold text-primary">${entityType}</div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="p-3 bg-light rounded-3">
                <div class="x-small text-muted fw-bold text-uppercase mb-1">Entity Reference</div>
                <div class="font-monospace small text-dark">${
                  entityId || "N/A"
                }</div>
            </div>
        </div>
        `
            : ""
        }
    </div>
  `;

  contentContainer.innerText = JSON.stringify(details, null, 2);

  new bootstrap.Modal(document.getElementById("logDetailsModal")).show();
};

function displaySecurityEvents(events, summary) {
  const container = document.getElementById("securityEventsContainer");

  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="card card-premium border-0 p-5 text-center">
        <div class="mb-3 text-success"><i class="fas fa-shield-alt fa-3x opacity-25"></i></div>
        <h6 class="fw-bold text-dark">No Incidents Detected</h6>
        <p class="text-muted small mb-0">Your system security registry is currently clear for this period.</p>
      </div>
    `;
    return;
  }

  let html = '<div class="row g-3 mb-4">';
  summary.forEach((s) => {
    html += `<div class="col-md-4">
            <div class="card card-premium border-0">
                <div class="card-body p-3">
                    <div class="text-muted x-small fw-bold text-uppercase">${s.action}</div>
                    <div class="h4 mb-0 fw-bold text-danger">${s.count}</div>
                </div>
            </div>
        </div>`;
  });
  html += "</div>";

  html += `<div class="card card-premium border-0 overflow-hidden">
            <div class="card-header bg-white py-3 border-bottom-0"><h6 class="fw-bold mb-0">Critical Event Log</h6></div>
            <div class="table-responsive">
                <table class="table table-excel table-hover mb-0 align-middle">
                    <thead><tr><th class="ps-4">Timestamp</th><th>User</th><th>Incident Type</th><th class="pe-4">Context</th></tr></thead>
                    <tbody>`;

  events.forEach((event) => {
    const date = new Date(event.created_at);
    const timestamp = `
        <div class="small">
            <div class="text-dark fw-semibold">${date.toLocaleDateString()}</div>
            <div class="text-muted x-small">${date.toLocaleTimeString()}</div>
        </div>
    `;

    let detailsPreview = "-";
    let fullDetails = null;

    if (event.details) {
      try {
        const parsed =
          typeof event.details === "string"
            ? JSON.parse(event.details)
            : event.details;
        fullDetails = parsed;
        const str = JSON.stringify(parsed);
        detailsPreview = str.length > 50 ? str.substring(0, 50) + "..." : str;
      } catch (e) {
        detailsPreview = String(event.details);
      }
    }

    html += `<tr>
            <td class="ps-4">${timestamp}</td>
            <td class="small fw-bold text-dark">${
              event.user_name || "Unknown"
            }</td>
            <td><span class="badge bg-danger bg-opacity-10 text-danger rounded-pill px-3 py-1 log-badge">${
              event.action
            }</span></td>
            <td class="pe-4">
                <div class="d-flex align-items-center">
                    <small class="text-muted font-monospace me-2 text-truncate" style="max-width: 200px;">${detailsPreview}</small>
                    ${
                      fullDetails
                        ? `<button class="btn btn-sm btn-outline-danger border-0 rounded-circle" onclick='showLogDetails(${JSON.stringify(
                            fullDetails,
                          ).replace(/'/g, "&apos;")}, null, null, "${
                            event.user_name || "Unknown"
                          }", "${date.toLocaleString()}")' title="Investigate">
                            <i class="fas fa-exclamation-circle"></i></button>`
                        : ""
                    }
                </div>
            </td>
        </tr>`;
  });

  html += "</tbody></table></div></div>";
  container.innerHTML = html;
}

function updatePagination(page, total, itemsPerPage) {
  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, total);

  const info = document.getElementById("activityPaginationInfo");
  if (total > 0) {
    info.textContent = `Showing range audit ${start}-${end} of ${total} total records`;
  } else {
    info.textContent = "No records found";
  }

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
