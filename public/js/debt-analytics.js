// Debt Analytics JavaScript Module

let agingChart, reasonChart, trendsChart;

document.addEventListener("DOMContentLoaded", () => {
  loadDebtAnalytics();
});

async function loadDebtAnalytics() {
  try {
    await Promise.all([
      loadDebtOverview(),
      loadDebtAging(),
      loadRepaymentTrends(),
    ]);
  } catch (error) {
    console.error("Load debt analytics error:", error);
    ui.toast("Failed to load debt analytics", "error");
  }
}

async function loadDebtOverview() {
  try {
    const data = await api.get("/debts/analytics/overview");
    if (data.success) {
      const stats = data.stats;

      // Update KPIs
      document.getElementById("totalOutstanding").textContent = `${parseFloat(
        stats.total_outstanding
      ).toLocaleString()} ETB`;
      document.getElementById("totalIssued").textContent = `${parseFloat(
        stats.total_debt_issued
      ).toLocaleString()} ETB`;
      document.getElementById("totalRepaid").textContent = `${(
        parseFloat(stats.total_debt_issued) -
        parseFloat(stats.total_outstanding)
      ).toLocaleString()} ETB`;
      document.getElementById("activeDebtors").textContent =
        stats.active_debtors.toLocaleString();

      // Update reason chart
      updateReasonChart(stats.breakdown_by_reason);

      // Display top debtors
      displayTopDebtors(stats.top_debtors);
    }
  } catch (error) {
    console.error("Load debt overview error:", error);
  }
}

async function loadDebtAging() {
  try {
    const data = await api.get("/debts/analytics/aging");
    if (data.success) {
      updateAgingChart(data.aging);
    }
  } catch (error) {
    console.error("Load debt aging error:", error);
  }
}

async function loadRepaymentTrends() {
  try {
    const data = await api.get("/debts/analytics/trends?months=6");
    if (data.success) {
      updateTrendsChart(data.trends);
    }
  } catch (error) {
    console.error("Load repayment trends error:", error);
  }
}

function updateAgingChart(aging) {
  const ctx = document.getElementById("debtAgingChart").getContext("2d");

  if (agingChart) agingChart.destroy();

  agingChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["0-30 Days", "31-60 Days", "61-90 Days", "90+ Days"],
      datasets: [
        {
          label: "Outstanding Amount (ETB)",
          data: [
            parseFloat(aging.period_0_30),
            parseFloat(aging.period_31_60),
            parseFloat(aging.period_61_90),
            parseFloat(aging.period_90_plus),
          ],
          backgroundColor: ["#3b82f6", "#f59e0b", "#ef4444", "#7f1d1d"],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => v.toLocaleString() + " ETB" },
        },
      },
    },
  });
}

function updateReasonChart(breakdown) {
  const ctx = document.getElementById("debtReasonChart").getContext("2d");

  if (reasonChart) reasonChart.destroy();

  reasonChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: breakdown.map((b) => b.reason || "Other"),
      datasets: [
        {
          data: breakdown.map((b) => parseFloat(b.total_amount)),
          backgroundColor: [
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#8b5cf6",
            "#a855f7",
          ],
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
}

function updateTrendsChart(trends) {
  const ctx = document.getElementById("repaymentTrendsChart").getContext("2d");

  if (trendsChart) trendsChart.destroy();

  trendsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: trends.map((t) => t.month),
      datasets: [
        {
          label: "Debt Created",
          data: trends.map((t) => parseFloat(t.debt_created)),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Repayments",
          data: trends.map((t) => parseFloat(t.repayments)),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => v.toLocaleString() + " ETB" },
        },
      },
    },
  });
}

function displayTopDebtors(debtors) {
  const container = document.getElementById("topDebtorsTable");

  if (!debtors || debtors.length === 0) {
    container.innerHTML =
      '<p class="text-center p-4 text-muted">No active debtors found</p>';
    return;
  }

  let html = `
        <table class="table table-hover align-middle">
            <thead>
                <tr>
                    <th>Driver</th>
                    <th>Total Debt</th>
                    <th>Remaining</th>
                    <th>Last Repayment</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

  debtors.forEach((debtor) => {
    const repaidPercent = (
      ((parseFloat(debtor.total_amount) - parseFloat(debtor.remaining_amount)) /
        parseFloat(debtor.total_amount)) *
      100
    ).toFixed(0);

    html += `
            <tr>
                <td>
                    <div class="fw-bold">${debtor.full_name}</div>
                    <div class="small text-muted">${debtor.driver_id}</div>
                </td>
                <td>${parseFloat(debtor.total_amount).toLocaleString()} ETB</td>
                <td>
                    <div class="fw-bold text-danger">${parseFloat(
                      debtor.remaining_amount
                    ).toLocaleString()} ETB</div>
                    <div class="progress mt-1" style="height: 4px; width: 100px;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${repaidPercent}%"></div>
                    </div>
                </td>
                <td>${
                  debtor.last_repayment_date
                    ? new Date(debtor.last_repayment_date).toLocaleDateString()
                    : "No repayments"
                }</td>
                <td>
                    <span class="badge rounded-pill bg-light text-dark border">${repaidPercent}% Repaid</span>
                </td>
                <td>
                    <a href="/pages/driver-detail.html?id=${
                      debtor.driver_id
                    }" class="btn btn-light btn-sm rounded-circle">
                        <i class="fas fa-eye text-primary"></i>
                    </a>
                </td>
            </tr>
        `;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

function exportDebtReport(type) {
  ui.toast(`Preparing ${type} report...`, "info");
  // Implement export logic via existing export controller if available
  // For now, it's a placeholder for the actual export implementation
  setTimeout(() => {
    ui.toast(
      "Export functionality will be available in the next update",
      "warning"
    );
  }, 1000);
}
