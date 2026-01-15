// System Health Dashboard JavaScript Module

let loadChart;

document.addEventListener("DOMContentLoaded", () => {
  // Permission Check
  const user = auth.getUser();
  if (!user || user.role !== "admin") {
    window.location.href = "/";
    return;
  }

  loadSystemHealth();
  // Auto refresh every 30 seconds
  setInterval(loadSystemHealth, 30000);
});

async function loadSystemHealth() {
  try {
    const data = await api.get("/system-health/dashboard");
    const perfData = await api.get("/system-health/performance");

    if (data.success && perfData && perfData.success) {
      updateDashboard(data.metrics, perfData.performance);
    } else if (data.success) {
      // Still show system metrics even if performance data fails
      updateDashboard(data.metrics, { db_latency_ms: "N/A" });
    }
  } catch (error) {
    console.error("Load system health error:", error);
    ui.toast("Failed to load system health metrics", "error");
  }
}

function updateDashboard(metrics, performance) {
  const sys = metrics.system;

  // Uptime
  const hours = Math.floor(sys.uptime / 3600);
  const minutes = Math.floor((sys.uptime % 3600) / 60);
  document.getElementById("uptimeText").textContent = `${hours}h ${minutes}m`;

  // Memory
  const freeGB = (sys.memory.free / 1024 ** 3).toFixed(2);
  const totalGB = (sys.memory.total / 1024 ** 3).toFixed(2);
  const usedGB = (parseFloat(totalGB) - parseFloat(freeGB)).toFixed(2);

  document.getElementById(
    "memoryPercent"
  ).textContent = `${sys.memory.usage_percent}%`;
  document.getElementById(
    "memoryProgress"
  ).style.width = `${sys.memory.usage_percent}%`;
  document.getElementById(
    "memoryText"
  ).textContent = `${usedGB} / ${totalGB} GB`;

  if (sys.memory.usage_percent > 85) {
    document.getElementById("memoryProgress").className =
      "progress-bar bg-danger";
  } else if (sys.memory.usage_percent > 70) {
    document.getElementById("memoryProgress").className =
      "progress-bar bg-warning";
  } else {
    document.getElementById("memoryProgress").className =
      "progress-bar bg-primary";
  }

  // Database
  document.getElementById(
    "dbLatency"
  ).textContent = `${performance.db_latency_ms}ms`;
  document.getElementById("dbDrivers").textContent =
    metrics.database.driver_count.toLocaleString();
  document.getElementById("dbPayments").textContent =
    metrics.database.payment_count.toLocaleString();
  document.getElementById("dbAudit").textContent =
    metrics.database.audit_count.toLocaleString();
  document.getElementById("dbNotifications").textContent =
    metrics.database.unread_notifications;

  // Storage
  const totalStorage = (
    parseFloat(metrics.storage.imports_size_mb) +
    parseFloat(metrics.storage.photos_size_mb)
  ).toFixed(2);
  document.getElementById(
    "storageSummary"
  ).textContent = `${totalStorage} MB Total`;
  document.getElementById(
    "importsSize"
  ).textContent = `${metrics.storage.imports_size_mb} MB`;

  // Environment
  document.getElementById("envPlatform").textContent = sys.platform;
  document.getElementById("envArch").textContent = sys.arch;
  document.getElementById("envCores").textContent = sys.cpu_count;

  const restartDate = new Date(Date.now() - sys.uptime * 1000);
  document.getElementById("envRestart").textContent =
    restartDate.toLocaleString();

  // Update Load Chart
  updateLoadChart(sys.cpu_load, sys.cpu_usage_percent, sys.platform);
}

function updateLoadChart(load, usage, platform) {
  const canvas = document.getElementById("loadChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const isWindows = platform && platform.toLowerCase().includes("win");
  let loadData, labels, labelText;

  if (isWindows) {
    // On Windows, show Current Usage as the primary metric
    loadData = [parseFloat(usage || 0)];
    labels = ["Current CPU Usage"];
    labelText = "CPU Usage (%)";
  } else {
    // On Unix-like systems, show Load Averages
    loadData = Array.isArray(load) ? load : [0, 0, 0];
    labels = ["1 min", "5 min", "15 min"];
    labelText = "System Load Average";
  }

  if (loadChart) loadChart.destroy();

  loadChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: labelText,
          data: loadData,
          backgroundColor: isWindows ? "#10b981" : "#3b82f6",
          borderRadius: 4,
          barThickness: isWindows ? 80 : 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (item) =>
              `Value: ${item.formattedValue}${isWindows ? "%" : ""}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: isWindows ? 100 : Math.max(...loadData, 1) + 0.5,
          ticks: {
            stepSize: isWindows ? 20 : 0.5,
            callback: (v) => `${v}${isWindows ? "%" : ""}`,
          },
        },
      },
    },
  });
}
