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
        s.total_tax_collected,
      ).toLocaleString()} ETB`;
      document.getElementById("verifiedDrivers").textContent =
        s.verification_stats.verified_drivers.toLocaleString();

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
              log.created_at,
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
      },
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

// Quick Tax Report Generation
async function generateQuickTaxReport(period) {
  const now = new Date();
  let startDate, endDate;

  if (period === "this_week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    startDate = new Date(now.setDate(diff));
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "last_week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
    startDate = new Date(now.setDate(diff));
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "this_month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === "last_month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (period === "ytd") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
  } else if (period === "custom") {
    const startInput = document.getElementById("customStartDate").value;
    const endInput = document.getElementById("customEndDate").value;
    if (!startInput || !endInput) {
      ui.toast("Please select both start and end dates", "error");
      return;
    }
    startDate = new Date(startInput);
    endDate = new Date(endInput);
  }

  // Format dates as YYYY-MM-DD
  const format = (d) => d.toISOString().split("T")[0];
  const startStr = format(startDate);
  const endStr = format(endDate);

  await fetchAndDisplayTaxReport(startStr, endStr);
}

// Shared function to fetch and display tax report
async function fetchAndDisplayTaxReport(startDate, endDate) {
  try {
    ui.showLoading(true); // Assuming ui.showLoading exists or we can add it

    // View online by default for quick reports
    const data = await api.get(
      `/reports/withholding-tax?start_date=${startDate}&end_date=${endDate}`,
    );

    if (data.success) {
      displayTaxReport(data);
      const resultsModal = new bootstrap.Modal(
        document.getElementById("taxResultsModal"),
      );
      resultsModal.show();
    }
  } catch (error) {
    console.error("Generate tax report error:", error);
    ui.toast("Failed to generate report", "error");
  } finally {
    ui.showLoading(false);
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
        },
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
        document.getElementById("taxReportModal"),
      ).hide();
    } else {
      // View online
      const data = await api.get(
        `/reports/withholding-tax?start_date=${startDate}&end_date=${endDate}`,
      );

      if (data.success) {
        displayTaxReport(data);
        bootstrap.Modal.getInstance(
          document.getElementById("taxReportModal"),
        ).hide();
        new bootstrap.Modal(document.getElementById("taxResultsModal")).show();
      }
    }
  } catch (error) {
    console.error("Generate tax report error:", error);
    ui.toast("Failed to generate report", "error");
  }
}

// Helper to update button labels
function updateQuickReportLabels() {
  const now = new Date();

  // This Week
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), diff);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
  const thisWeekLabel = document.getElementById("thisWeekLabel");
  if (thisWeekLabel) {
    thisWeekLabel.textContent = `${thisWeekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${thisWeekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  // Last Week
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
  const lastWeekLabel = document.getElementById("lastWeekLabel");
  if (lastWeekLabel) {
    lastWeekLabel.textContent = `${lastWeekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${lastWeekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  // This Month
  const thisMonthName = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const thisMonthLabel = document.getElementById("thisMonthLabel");
  if (thisMonthLabel) thisMonthLabel.textContent = thisMonthName;

  // Last Month
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthName = lastMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const lastMonthLabel = document.getElementById("lastMonthLabel");
  if (lastMonthLabel) lastMonthLabel.textContent = lastMonthName;

  // YTD
  const ytdLabel = document.getElementById("ytdLabel");
  if (ytdLabel)
    ytdLabel.textContent = `Jan 1 - ${now.toLocaleString("default", { month: "short", day: "numeric", year: "numeric" })}`;
}

// Initialize labels on load
document.addEventListener("DOMContentLoaded", updateQuickReportLabels);

function displayTaxReport(reportData) {
  const container = document.getElementById("taxReportResults");
  const modalHeader = document.querySelector("#taxResultsModal .modal-title");

  // Update header context
  if (modalHeader) {
    modalHeader.innerHTML = `<i class="fas fa-file-invoice-dollar me-2"></i>Tax Report: ${reportData.start_date} to ${reportData.end_date}`;
  }

  if (!reportData.data || reportData.data.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="mb-3 text-muted"><i class="fas fa-file-invoice fa-3x opacity-25"></i></div>
        <h5 class="fw-bold">No records found</h5>
        <p class="text-muted small">There are no withheld tax records for the selected period.</p>
      </div>`;
    return;
  }

  // Calculate totals for verification
  const totalGross = reportData.data.reduce(
    (sum, row) => sum + parseFloat(row.calculated_gross_payout || 0),
    0,
  );
  const totalNet = reportData.data.reduce(
    (sum, row) => sum + parseFloat(row.net_payout || 0),
    0,
  );

  let html = `
    <!-- Action Toolbar -->
    <div class="d-flex justify-content-between align-items-center mb-4 p-3 bg-light rounded-3">
        <div class="d-flex gap-2">
            <div class="bg-white px-3 py-2 rounded border">
                <small class="text-muted d-block text-uppercase fw-bold" style="font-size: 10px;">Total Tax Withheld</small>
                <div class="fw-bold text-danger">${reportData.total_tax_collected.toLocaleString()} ETB</div>
            </div>
            <div class="bg-white px-3 py-2 rounded border">
                <small class="text-muted d-block text-uppercase fw-bold" style="font-size: 10px;">Record Count</small>
                <div class="fw-bold text-dark">${reportData.total_records}</div>
            </div>
        </div>
        <div class="btn-group">
            <button class="btn btn-outline-success btn-sm" onclick="downloadTaxReportExcel('${reportData.start_date}', '${reportData.end_date}')">
                <i class="fas fa-file-excel me-2"></i>Download Excel
            </button>
            <button class="btn btn-outline-dark btn-sm" onclick="toggleJsonView()">
                <i class="fas fa-code me-2"></i>JSON View
            </button>
        </div>
    </div>

    <!-- Tab Content -->
    <div id="taxTableView">
        <div class="table-responsive">
            <table class="table table-excel table-hover table-sm align-middle mb-0">
                <thead class="bg-light">
                    <tr>
                        <th class="ps-3 py-2">#</th>
                        <th class="py-2">Date</th>
                        <th class="py-2">Driver</th>
                        <th class="py-2">TIN Number</th>
                        <th class="text-end py-2">Gross Payout</th>
                        <th class="text-end py-2">Tax Rate</th>
                        <th class="text-end py-2">Withholding Tax</th>
                        <th class="text-end pe-3 py-2">Net Payout</th>
                    </tr>
                </thead>
                <tbody>`;

  reportData.data.forEach((row, index) => {
    const taxRate =
      parseFloat(row.calculated_gross_payout) > 0
        ? (
            (parseFloat(row.calculated_withholding_tax) / parseFloat(row.calculated_gross_payout)) *
            100
          ).toFixed(1) + "%"
        : "0%";

    html += `<tr>
            <td class="ps-3 text-muted small">${index + 1}</td>
            <td class="small">${new Date(row.week_date).toLocaleDateString()}</td>
            <td>
                <div class="fw-bold text-dark small">${row.full_name}</div>
                <div class="x-small text-muted font-monospace">${row.driver_id}</div>
            </td>
            <td><code class="text-primary small">${row.tin || "MISSING-TIN"}</code></td>
            <td class="text-end font-monospace small">${parseFloat(row.calculated_gross_payout).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="text-end small text-muted">${taxRate}</td>
            <td class="text-end fw-bold text-danger font-monospace small">${parseFloat(row.calculated_withholding_tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="text-end pe-3 font-monospace small text-dark">${parseFloat(row.calculated_net_payout).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>`;
  });

  html += `</tbody>
            <tfoot class="bg-light fw-bold border-top-2">
                <tr>
                    <td colspan="4" class="ps-3 py-2 text-end text-uppercase x-small text-muted">Total Summary</td>
                    <td class="text-end py-2">${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td></td>
                    <td class="text-end py-2 text-danger">${reportData.total_tax_collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="text-end pe-3 py-2">${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
            </tfoot>
        </table>
    </div>
  </div>
  
  <!-- JSON View (Hidden by default) -->
  <div id="taxJsonView" style="display: none;">
    <div class="bg-dark text-light p-3 rounded-3 font-monospace small" style="max-height: 500px; overflow-y: auto;">
        <div class="d-flex justify-content-end mb-2">
            <button class="btn btn-sm btn-outline-light" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)">
                <i class="fas fa-copy me-1"></i> Copy
            </button>
            <div style="display:none">${JSON.stringify(reportData, null, 2)}</div>
        </div>
        <pre class="m-0 text-success">${syntaxHighlight(reportData)}</pre>
    </div>
  </div>`;

  container.innerHTML = html;
}

// Helper: Toggle between Table and JSON view
window.toggleJsonView = function () {
  const table = document.getElementById("taxTableView");
  const json = document.getElementById("taxJsonView");
  if (table.style.display === "none") {
    table.style.display = "block";
    json.style.display = "none";
  } else {
    table.style.display = "none";
    json.style.display = "block";
  }
};

// Helper: Download Excel directly
window.downloadTaxReportExcel = async function (startDate, endDate) {
  try {
    ui.toast("Downloading Excel report...", "info");
    const response = await fetch(
      `/api/reports/withholding-tax?start_date=${startDate}&end_date=${endDate}&format=excel`,
      {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      },
    );

    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Tax_Report_${startDate}_${endDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    ui.toast("Download complete", "success");
  } catch (error) {
    console.error("Excel download error:", error);
    ui.toast("Failed to download Excel", "error");
  }
};

// Helper: Syntax Highlight JSON
function syntaxHighlight(json) {
  if (typeof json != "string") {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    function (match) {
      var cls = "text-warning"; // string
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-info"; // key
        }
      } else if (/true|false/.test(match)) {
        cls = "text-primary"; // boolean
      } else if (/null/.test(match)) {
        cls = "text-muted"; // null
      } else {
        cls = "text-danger"; // number
      }
      return '<span class="' + cls + '">' + match + "</span>";
    },
  );
}

async function loadTinLog() {
  try {
    const startDate = document.getElementById("tinStartDate").value;
    const endDate = document.getElementById("tinEndDate").value;

    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const data = await api.get(
      `/reports/tin-verification-log?${params.toString()}`,
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
        driverId,
      )}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      },
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
      document.getElementById("driverStatementModal"),
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
