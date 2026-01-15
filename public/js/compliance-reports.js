// Compliance Reports JavaScript Module
let verificationChart;

document.addEventListener("DOMContentLoaded", () => {
  // Permission Check
  const user = auth.getUser();
  if (!user || !["admin", "director", "auditor"].includes(user.role)) {
    window.location.href = "/";
    return;
  }

  loadComplianceDashboard();
  loadComplianceActivity();
});

async function loadComplianceDashboard() {
  try {
    const data = await api.get("/reports/compliance-summary");
    if (data.success) {
      const s = data.summary;

      // Update KPIs
      document.getElementById("totalTaxWithheld").textContent = `${parseFloat(
        s.total_tax_collected
      ).toLocaleString()} ETB`;
      document.getElementById("verifiedDrivers").textContent =
        s.verification_stats.verified_drivers.toLocaleString();
      document.getElementById("pendingVerifications").textContent =
        s.pending_verifications.toLocaleString();
      document.getElementById("recentAlerts").textContent =
        s.recent_alerts.toLocaleString();

      updateVerificationChart(s.verification_stats);
    }
  } catch (error) {
    console.error("Load compliance dashboard error:", error);
  }
}

function updateVerificationChart(stats) {
  const ctx = document
    .getElementById("verificationDistributionChart")
    .getContext("2d");

  if (verificationChart) {
    verificationChart.destroy();
  }

  verificationChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Verified", "Unverified"],
      datasets: [
        {
          data: [stats.verified_drivers, stats.unverified_drivers],
          backgroundColor: ["#16a34a", "#dc2626"],
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });

  // Detailed stats list
  const total = stats.total_drivers;
  const verifiedPercent = ((stats.verified_drivers / total) * 100).toFixed(1);

  document.getElementById("verificationStats").innerHTML = `
        <div class="d-flex justify-content-between mb-1 small">
            <span>Verified Compliance</span>
            <span class="fw-bold text-success">${verifiedPercent}%</span>
        </div>
        <div class="progress" style="height: 6px;">
            <div class="progress-bar bg-success" style="width: ${verifiedPercent}%"></div>
        </div>
    `;
}

async function loadComplianceActivity() {
  try {
    const data = await api.get("/reports/tin-verification-log?limit=5");
    if (data.success) {
      displayActivityTable(data.data);
    }
  } catch (error) {
    console.error("Load activity error:", error);
  }
}

function displayActivityTable(logs) {
  const container = document.getElementById("complianceActivityTable");

  if (!logs || logs.length === 0) {
    container.innerHTML =
      '<div class="text-center py-4 text-muted">No recent activity detected</div>';
    return;
  }

  let html =
    '<div class="table-responsive"><table class="table table-hover table-sm">';
  html +=
    "<thead><tr><th>Date</th><th>Entity</th><th>Action</th><th>Status</th></tr></thead><tbody>";

  logs.forEach((log) => {
    html += `<tr>
            <td><small>${new Date(
              log.created_at
            ).toLocaleDateString()}</small></td>
            <td><code class="small">${log.entity_id || "N/A"}</code></td>
            <td>${log.action}</td>
            <td>${
              log.verified
                ? '<span class="badge bg-success-subtle text-success x-small">Success</span>'
                : '<span class="badge bg-danger-subtle text-danger x-small">Failed/Pending</span>'
            }</td>
        </tr>`;
  });

  html += "</tbody></table></div>";
  container.innerHTML = html;
}

async function handleTinLog() {
  const format = document.getElementById("tinFormat").value;
  if (format === "excel") {
    downloadTinExcel();
  } else {
    loadTinLog();
  }
}

async function downloadTinExcel() {
  try {
    const startDate = document.getElementById("tinStartDate").value;
    const endDate = document.getElementById("tinEndDate").value;

    ui.toast("Generating Excel TIN Log...", "info");

    const response = await fetch(
      `/api/reports/tin-verification-log?start_date=${startDate}&end_date=${endDate}&format=excel`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tin_audit_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    ui.toast("Download complete", "success");
  } catch (error) {
    console.error("Download error:", error);
    ui.toast("Failed to download Excel", "error");
  }
}

async function generateTaxReport() {
  try {
    const startDate = document.getElementById("taxStartDate").value;
    const endDate = document.getElementById("taxEndDate").value;
    const format = document.getElementById("taxFormat").value;

    if (!startDate || !endDate) {
      ui.toast("Please select start and end dates", "error");
      return;
    }

    if (format === "excel") {
      // Download Excel file
      ui.toast("Generating Excel report...", "info");

      const response = await fetch(
        `/api/reports/withholding-tax?start_date=${startDate}&end_date=${endDate}&format=excel`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Report generation failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `withholding_tax_${startDate}_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      ui.toast("Report generated successfully", "success");
      bootstrap.Modal.getInstance(
        document.getElementById("taxReportModal")
      ).hide();
    } else {
      // View online
      const data = await api.get(
        `/reports/withholding-tax?start_date=${startDate}&end_date=${endDate}`
      );

      if (data.success) {
        displayTaxReport(data);
        bootstrap.Modal.getInstance(
          document.getElementById("taxReportModal")
        ).hide();
        new bootstrap.Modal(document.getElementById("taxResultsModal")).show();
      }
    }
  } catch (error) {
    console.error("Generate tax report error:", error);
    ui.toast("Failed to generate report", "error");
  }
}

function displayTaxReport(reportData) {
  const container = document.getElementById("taxReportResults");

  if (!reportData.data || reportData.data.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">No data found for the selected period</p>';
    return;
  }

  let html = '<div class="mb-4">';
  html += `<h6>Report Summary</h6>`;
  html += `<p><strong>Period:</strong> ${reportData.start_date} to ${reportData.end_date}</p>`;
  html += `<p><strong>Total Records:</strong> ${reportData.total_records}</p>`;
  html += `<p><strong>Total Tax Collected:</strong> ${reportData.total_tax_collected.toLocaleString()} ETB</p>`;
  html += "</div>";

  html += '<div class="table-responsive">';
  html += '<table class="table table-hover table-sm">';
  html += "<thead><tr>";
  html +=
    "<th>Driver ID</th><th>Name</th><th>TIN</th><th>Gross (ETB)</th><th>Tax (ETB)</th><th>Net (ETB)</th><th>Payments</th>";
  html += "</tr></thead><tbody>";

  reportData.data.forEach((row) => {
    html += `<tr>
            <td><code class="small">${row.driver_id}</code></td>
            <td>${row.full_name}</td>
            <td>${row.tin || "N/A"}</td>
            <td class="text-end">${parseFloat(
              row.total_gross
            ).toLocaleString()}</td>
            <td class="text-end fw-bold text-danger">${parseFloat(
              row.total_tax
            ).toLocaleString()}</td>
            <td class="text-end">${parseFloat(
              row.total_net
            ).toLocaleString()}</td>
            <td class="text-center">${row.payment_count}</td>
        </tr>`;
  });

  html += "</tbody></table></div>";
  container.innerHTML = html;
}

async function loadTinLog() {
  try {
    const startDate = document.getElementById("tinStartDate").value;
    const endDate = document.getElementById("tinEndDate").value;

    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const data = await api.get(
      `/reports/tin-verification-log?${params.toString()}`
    );

    if (data.success) {
      displayTinLog(data);
    }
  } catch (error) {
    console.error("Load TIN log error:", error);
    ui.toast("Failed to load TIN verification log", "error");
  }
}

function displayTinLog(logData) {
  const container = document.getElementById("tinLogResults");

  if (!logData.data || logData.data.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">No verification logs found</p>';
    return;
  }

  let html = '<div class="mb-3">';
  html += `<p class="fw-bold">Total Verifications: ${logData.total_verifications}</p>`;
  html += "</div>";

  html += '<div class="table-responsive">';
  html += '<table class="table table-hover table-sm">';
  html += "<thead><tr>";
  html +=
    "<th>Date</th><th>Driver</th><th>TIN</th><th>Action</th><th>Verified By</th><th>Status</th>";
  html += "</tr></thead><tbody>";

  logData.data.forEach((log) => {
    html += `<tr>
            <td><small>${new Date(log.created_at).toLocaleString()}</small></td>
            <td>${log.full_name || "N/A"}</td>
            <td>${log.tin || "N/A"}</td>
            <td><span class="badge bg-primary">${log.action}</span></td>
            <td>${log.verified_by_name || "System"}</td>
            <td>${
              log.verified
                ? '<span class="badge-verified">Verified</span>'
                : '<span class="badge-unverified">Unverified</span>'
            }</td>
        </tr>`;
  });

  html += "</tbody></table></div>";
  container.innerHTML = html;
}

async function generateDriverStatement() {
  try {
    const driverId = document.getElementById("statementDriverId").value.trim();
    const startDate = document.getElementById("statementStartDate").value;
    const endDate = document.getElementById("statementEndDate").value;

    if (!driverId) {
      ui.toast("Please enter a driver ID", "error");
      return;
    }

    ui.toast("Generating PDF statement...", "info");

    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const response = await fetch(
      `/api/reports/driver-statement/${encodeURIComponent(
        driverId
      )}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Driver not found");
      }
      throw new Error("Statement generation failed");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${driverId}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    ui.toast("Statement generated successfully", "success");
    bootstrap.Modal.getInstance(
      document.getElementById("driverStatementModal")
    ).hide();

    // Clear form
    document.getElementById("statementDriverId").value = "";
    document.getElementById("statementStartDate").value = "";
    document.getElementById("statementEndDate").value = "";
  } catch (error) {
    console.error("Generate driver statement error:", error);
    ui.toast(error.message || "Failed to generate statement", "error");
  }
}
