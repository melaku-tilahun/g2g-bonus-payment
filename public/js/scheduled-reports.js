// Scheduled Reports JavaScript Module

let scheduleModal;

document.addEventListener("DOMContentLoaded", () => {
  // Permission Check
  const user = auth.getUser();
  if (!user || !["admin", "director"].includes(user.role)) {
    window.location.href = "/index.html";
    return;
  }

  scheduleModal = new bootstrap.Modal(
    document.getElementById("addScheduleModal")
  );
  loadSchedules();
});

async function loadSchedules() {
  try {
    const data = await api.get("/reports/schedules");

    if (data.success) {
      displaySchedules(data.schedules);
    }
  } catch (error) {
    console.error("Load schedules error:", error);
    ui.toast("Failed to load schedules", "error");
  }
}

function displaySchedules(schedules) {
  const container = document.getElementById("schedulesList");

  if (!schedules || schedules.length === 0) {
    container.innerHTML = `
            <div class="card-premium p-5 text-center">
                <i class="fas fa-calendar-times fa-3x text-muted mb-3 opacity-25"></i>
                <p class="text-muted">No scheduled reports configured</p>
                <button class="btn btn-brand" data-bs-toggle="modal" data-bs-target="#addScheduleModal">
                    Create Your First Schedule
                </button>
            </div>
        `;
    return;
  }

  let html = "";

  schedules.forEach((schedule) => {
    const recipients = JSON.parse(schedule.recipients);
    const isActive = schedule.is_active;
    const nextRun = schedule.next_run
      ? new Date(schedule.next_run).toLocaleString()
      : "Not scheduled";
    const lastRun = schedule.last_run
      ? new Date(schedule.last_run).toLocaleString()
      : "Never";

    html += `
            <div class="card-premium mb-3 p-4">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <h5 class="fw-bold mb-0 me-3">${schedule.name}</h5>
                            ${
                              isActive
                                ? '<span class="badge bg-success">Active</span>'
                                : '<span class="badge bg-secondary">Inactive</span>'
                            }
                        </div>
                        <div class="row g-3 mt-2">
                            <div class="col-md-3">
                                <small class="text-muted d-block">Report Type</small>
                                <strong>${schedule.report_type}</strong>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted d-block">Frequency</small>
                                <strong>${schedule.frequency}</strong>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted d-block">Next Run</small>
                                <strong>${nextRun}</strong>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted d-block">Last Run</small>
                                <strong>${lastRun}</strong>
                            </div>
                        </div>
                        <div class="mt-3">
                            <small class="text-muted d-block mb-1">Recipients</small>
                            <div class="d-flex flex-wrap gap-2">
                                ${recipients
                                  .map(
                                    (email) =>
                                      `<span class="badge bg-light text-dark">${email}</span>`
                                  )
                                  .join("")}
                            </div>
                        </div>
                        ${
                          schedule.created_by_name
                            ? `<small class="text-muted mt-2 d-block">Created by: ${schedule.created_by_name}</small>`
                            : ""
                        }
                    </div>
                    <div class="btn-group ms-3">
                        <button class="btn btn-sm ${
                          isActive ? "btn-warning" : "btn-success"
                        }" 
                                onclick="toggleSchedule(${
                                  schedule.id
                                }, ${!isActive})">
                            <i class="fas fa-${
                              isActive ? "pause" : "play"
                            }"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="editSchedule(${
                          schedule.id
                        })">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteSchedule(${
                          schedule.id
                        })">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
  });

  container.innerHTML = html;
}

async function saveSchedule() {
  try {
    const id = document.getElementById("scheduleId").value;
    const name = document.getElementById("scheduleName").value.trim();
    const reportType = document.getElementById("scheduleReportType").value;
    const frequency = document.getElementById("scheduleFrequency").value;
    const recipientsText = document
      .getElementById("scheduleRecipients")
      .value.trim();
    const parametersText = document
      .getElementById("scheduleParameters")
      .value.trim();

    // Validation
    if (!name) {
      ui.toast("Please enter a schedule name", "error");
      return;
    }

    if (!reportType) {
      ui.toast("Please select a report type", "error");
      return;
    }

    if (!recipientsText) {
      ui.toast("Please enter at least one recipient", "error");
      return;
    }

    // Parse recipients
    const recipients = recipientsText
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email);

    // Parse parameters (if provided)
    let parameters = null;
    if (parametersText) {
      try {
        parameters = JSON.parse(parametersText);
      } catch (e) {
        ui.toast("Invalid JSON in parameters field", "error");
        return;
      }
    }

    const payload = {
      name,
      report_type: reportType,
      frequency,
      recipients,
      parameters,
    };

    if (id) {
      // Update existing
      await api.put(`/reports/schedules/${id}`, payload);
      ui.toast("Schedule updated successfully", "success");
    } else {
      // Create new
      await api.post("/reports/schedules", payload);
      ui.toast("Schedule created successfully", "success");
    }

    scheduleModal.hide();
    clearScheduleForm();
    await loadSchedules();
  } catch (error) {
    console.error("Save schedule error:", error);
    ui.toast("Failed to save schedule", "error");
  }
}

async function editSchedule(id) {
  try {
    const data = await api.get("/reports/schedules");
    const schedule = data.schedules.find((s) => s.id === id);

    if (!schedule) {
      ui.toast("Schedule not found", "error");
      return;
    }

    // Populate form
    document.getElementById("scheduleId").value = schedule.id;
    document.getElementById("scheduleName").value = schedule.name;
    document.getElementById("scheduleReportType").value = schedule.report_type;
    document.getElementById("scheduleFrequency").value = schedule.frequency;

    const recipients = JSON.parse(schedule.recipients);
    document.getElementById("scheduleRecipients").value = recipients.join(", ");

    if (schedule.parameters) {
      const params = JSON.parse(schedule.parameters);
      document.getElementById("scheduleParameters").value = JSON.stringify(
        params,
        null,
        2
      );
    }

    document.getElementById("scheduleModalTitle").textContent =
      "Edit Report Schedule";
    scheduleModal.show();
  } catch (error) {
    console.error("Edit schedule error:", error);
    ui.toast("Failed to load schedule details", "error");
  }
}

async function toggleSchedule(id, isActive) {
  try {
    await api.put(`/reports/schedules/${id}`, { is_active: isActive });
    ui.toast(
      `Schedule ${isActive ? "activated" : "paused"} successfully`,
      "success"
    );
    await loadSchedules();
  } catch (error) {
    console.error("Toggle schedule error:", error);
    ui.toast("Failed to update schedule status", "error");
  }
}

async function deleteSchedule(id) {
  if (!confirm("Are you sure you want to delete this schedule?")) return;

  try {
    await api.delete(`/reports/schedules/${id}`);
    ui.toast("Schedule deleted successfully", "success");
    await loadSchedules();
  } catch (error) {
    console.error("Delete schedule error:", error);
    ui.toast("Failed to delete schedule", "error");
  }
}

function clearScheduleForm() {
  document.getElementById("scheduleId").value = "";
  document.getElementById("scheduleName").value = "";
  document.getElementById("scheduleReportType").value = "";
  document.getElementById("scheduleFrequency").value = "monthly";
  document.getElementById("scheduleRecipients").value = "";
  document.getElementById("scheduleParameters").value = "";
  document.getElementById("scheduleModalTitle").textContent =
    "Create Report Schedule";
}

// Clear form when modal is hidden
document
  .getElementById("addScheduleModal")
  .addEventListener("hidden.bs.modal", () => {
    clearScheduleForm();
  });
