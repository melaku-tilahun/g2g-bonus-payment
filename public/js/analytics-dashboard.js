// Analytics Dashboard JavaScript Module

let revenueChart, earningsDistChart, taxChart;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  // Permission Check
  const user = auth.getUser();
  if (!user || !["admin", "director", "manager"].includes(user.role)) {
    window.location.href = "/";
    return;
  }

  // Set default dates (last 6 months)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  document.getElementById("endDate").valueAsDate = endDate;
  document.getElementById("startDate").valueAsDate = startDate;

  // Load initial data
  loadAnalytics();
});

async function loadAnalytics() {
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const period = document.getElementById("trendPeriod").value;

  try {
    // Load all analytics data
    await Promise.all([
      loadFinancialOverview(startDate, endDate),
      loadRevenueTrends(period),
      loadTaxAnalytics(startDate, endDate),
      loadEarningsDistribution(startDate, endDate),
      loadDriverPerformance(),
    ]);
  } catch (error) {
    console.error("Load analytics error:", error);
    ui.toast("Failed to load analytics data", "error");
  }
}

async function loadFinancialOverview(startDate, endDate) {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const data = await api.get(
      `/analytics/financial-overview?${params.toString()}`
    );

    if (data.success) {
      const overview = data.overview;

      // Update KPI cards
      document.getElementById("totalRevenue").textContent = `${parseFloat(
        overview.total_revenue
      ).toLocaleString()} ETB`;
      document.getElementById("taxCollected").textContent = `${parseFloat(
        overview.total_tax
      ).toLocaleString()} ETB`;
      document.getElementById("activeDrivers").textContent =
        overview.active_drivers.toLocaleString();
      document.getElementById(
        "avgPayoutTime"
      ).textContent = `${overview.avg_payout_time_days} days`;

      // Update Growth Badges
      updateGrowthBadge("growthRevenue", overview.growth.revenue);
      updateGrowthBadge("growthTax", overview.growth.tax);
      updateGrowthBadge("growthDrivers", overview.growth.drivers);
    }
  } catch (error) {
    console.error("Load financial overview error:", error);
  }
}

function updateGrowthBadge(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  const val = parseFloat(value);
  const isPositive = val >= 0;

  el.className = `badge-growth ${isPositive ? "positive" : "negative"}`;
  el.innerHTML = `<i class="fas fa-arrow-${
    isPositive ? "up" : "down"
  } me-1"></i>${Math.abs(val)}%`;

  if (val === 0) {
    el.classList.add("d-none");
  } else {
    el.classList.remove("d-none");
  }
}

async function loadEarningsDistribution(startDate, endDate) {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const data = await api.get(
      `/analytics/earnings-distribution?${params.toString()}`
    );
    if (data.success) {
      updateEarningsDistributionChart(data.distribution);
    }
  } catch (error) {
    console.error("Load earnings distribution error:", error);
  }
}

function updateEarningsDistributionChart(distribution) {
  const ctx = document
    .getElementById("earningsDistributionChart")
    .getContext("2d");

  if (earningsDistChart) {
    earningsDistChart.destroy();
  }

  earningsDistChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: distribution.map((d) => d.bucket),
      datasets: [
        {
          label: "Number of Drivers",
          data: distribution.map((d) => d.driver_count),
          backgroundColor: "rgba(37, 99, 235, 0.7)",
          borderColor: "rgb(37, 99, 235)",
          borderWidth: 1,
          borderRadius: 4,
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
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}

async function loadRevenueTrends(period) {
  try {
    const data = await api.get(
      `/analytics/revenue-trends?period=${period}&months=6`
    );

    if (data.success && data.trends) {
      updateRevenueTrendsChart(data.trends);
    }
  } catch (error) {
    console.error("Load revenue trends error:", error);
  }
}

async function loadTaxAnalytics(startDate, endDate) {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const data = await api.get(`/analytics/tax-analytics?${params.toString()}`);

    if (data.success) {
      updateTaxChart(data.tax_breakdown);
    }
  } catch (error) {
    console.error("Load tax analytics error:", error);
  }
}

async function loadDriverPerformance() {
  try {
    const data = await api.get("/analytics/driver-performance?limit=10");

    if (data.success && data.top_performers) {
      displayTopPerformers(data.top_performers);
    }
  } catch (error) {
    console.error("Load driver performance error:", error);
  }
}

function updateRevenueTrendsChart(trends) {
  const ctx = document.getElementById("revenueTrendsChart").getContext("2d");

  if (revenueChart) {
    revenueChart.destroy();
  }

  revenueChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: trends.map((t) => t.period),
      datasets: [
        {
          label: "Revenue (ETB)",
          data: trends.map((t) => parseFloat(t.total_revenue || t.revenue)),
          borderColor: "rgb(37, 99, 235)",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "Tax Collected (ETB)",
          data: trends.map((t) => parseFloat(t.total_tax || t.tax)),
          borderColor: "rgb(234, 88, 12)",
          backgroundColor: "rgba(234, 88, 12, 0.1)",
          tension: 0.3,
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
          ticks: {
            callback: function (value) {
              return value.toLocaleString() + " ETB";
            },
          },
        },
      },
    },
  });
}

function updateTaxChart(taxData) {
  const ctx = document.getElementById("taxAnalyticsChart").getContext("2d");

  if (taxChart) {
    taxChart.destroy();
  }

  const taxable = parseInt(taxData.taxable_bonuses) || 0;
  const exempt = parseInt(taxData.tax_exempt_bonuses) || 0;

  taxChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Taxable Bonuses", "Tax Exempt Bonuses"],
      datasets: [
        {
          data: [taxable, exempt],
          backgroundColor: ["#ea580c", "#16a34a"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const total = taxable + exempt;
              const percentage = ((context.raw / total) * 100).toFixed(1);
              return (
                context.label + ": " + context.raw + " (" + percentage + "%)"
              );
            },
          },
        },
      },
    },
  });
}

function displayTopPerformers(performers) {
  const container = document.getElementById("topPerformersTable");

  if (!performers || performers.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">No data available</p>';
    return;
  }

  let html = '<div class="table-responsive"><table class="table table-hover">';
  html +=
    "<thead><tr><th>#</th><th>Driver</th><th>Earnings</th><th>Bonuses</th></tr></thead><tbody>";

  performers.forEach((driver, index) => {
    html += `<tr>
            <td>${index + 1}</td>
            <td>
                ${driver.full_name}
                ${
                  driver.verified
                    ? '<span class="badge-status badge-verified ms-2">Verified</span>'
                    : ""
                }
            </td>
            <td class="fw-bold text-primary">${parseFloat(
              driver.total_earnings
            ).toLocaleString()} ETB</td>
            <td>${driver.bonus_count}</td>
        </tr>`;
  });

  html += "</tbody></table></div>";
  container.innerHTML = html;
}
