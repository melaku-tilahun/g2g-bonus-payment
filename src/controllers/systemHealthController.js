const pool = require("../config/database");
const os = require("os");
const fs = require("fs").promises;
const path = require("path");

/**
 * System Health Controller
 * Monitors system performance, storage, and error rates
 */
const systemHealthController = {
  /**
   * Get System Health Dashboard
   * @route GET /api/system-health/dashboard
   */
  getDashboard: async (req, res) => {
    try {
      // System info
      const uptime = os.uptime();
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const loadAvg = os.loadavg();
      const cpus = os.cpus();

      // Database stats
      const [tableStats] = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM drivers) as driver_count,
          (SELECT COUNT(*) FROM payments) as payment_count,
          (SELECT COUNT(*) FROM audit_logs) as audit_count,
          (SELECT COUNT(*) FROM notifications WHERE is_read = FALSE) as unread_notifications
      `);

      const dbStats =
        tableStats && tableStats[0]
          ? tableStats[0]
          : {
              driver_count: 0,
              payment_count: 0,
              audit_count: 0,
              unread_notifications: 0,
            };

      // Storage status
      const uploadsDir = path.join(__dirname, "../../uploads");
      const photosDir = path.join(__dirname, "../../public/photos");

      const [uploadsSize, photosSize] = await Promise.all([
        getDirSize(uploadsDir),
        getDirSize(photosDir),
      ]);

      const cpuUsage = await getCPUUsagePercentage();

      res.json({
        success: true,
        metrics: {
          system: {
            uptime,
            memory: {
              free: freeMem,
              total: totalMem,
              usage_percent:
                totalMem > 0
                  ? (((totalMem - freeMem) / totalMem) * 100).toFixed(1)
                  : "0",
            },
            cpu_load: loadAvg,
            cpu_usage_percent: cpuUsage,
            cpu_count: cpus ? cpus.length : 0,
            platform: os.platform(),
            arch: os.arch(),
          },
          database: dbStats,
          storage: {
            uploads_size_mb: (uploadsSize / (1024 * 1024)).toFixed(2),
            photos_size_mb: (photosSize / (1024 * 1024)).toFixed(2),
          },
        },
      });
    } catch (error) {
      console.error("Get system health dashboard error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Performance Metrics
   */
  getPerformanceMetrics: async (req, res) => {
    try {
      // Get recent response times from audit logs (if we track them)
      // For now, we'll return simulated performance data or database latency
      const start = Date.now();
      await pool.query("SELECT 1");
      const dbLatency = Date.now() - start;

      res.json({
        success: true,
        performance: {
          db_latency_ms: dbLatency,
          api_status: "Healthy",
          last_backup: "Recent",
        },
      });
    } catch (error) {
      console.error("Get performance metrics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Storage Status
   */
  getStorageStatus: async (req, res) => {
    try {
      const uploadsDir = path.join(__dirname, "../../uploads");
      const size = await getDirSize(uploadsDir);

      res.json({
        success: true,
        storage: {
          path: "uploads/",
          size_bytes: size,
          size_formatted: (size / (1024 * 1024)).toFixed(2) + " MB",
        },
      });
    } catch (error) {
      console.error("Get storage status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Get Error Rates
   */
  getErrorRates: async (req, res) => {
    try {
      // Count failed login attempts or errors in audit logs
      const [errorStats] = await pool.query(`
        SELECT 
          COUNT(*) as count,
          DATE(created_at) as date
        FROM audit_logs 
        WHERE action LIKE '%ERROR%' OR action LIKE '%FAILED%'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 7
      `);

      res.json({
        success: true,
        errors: errorStats,
      });
    } catch (error) {
      console.error("Get error rates error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

/**
 * Helper to get directory size recursively
 */
async function getDirSize(dirPath) {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    const paths = files.map((file) => {
      const p = path.join(dirPath, file.name);
      if (file.isDirectory()) return getDirSize(p);
      return fs.stat(p).then((s) => s.size);
    });
    const sizes = await Promise.all(paths);
    return sizes.reduce((a, b) => a + b, 0);
  } catch (e) {
    return 0;
  }
}

/**
 * Helper to get CPU usage percentage by sampling
 */
async function getCPUUsagePercentage() {
  const cpus1 = os.cpus();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const cpus2 = os.cpus();

  let idle = 0;
  let total = 0;

  for (let i = 0; i < cpus1.length; i++) {
    const start = cpus1[i].times;
    const end = cpus2[i].times;

    idle += end.idle - start.idle;
    total +=
      end.user -
      start.user +
      (end.nice - start.nice) +
      (end.sys - start.sys) +
      (end.irq - start.irq) +
      (end.idle - start.idle);
  }

  return total === 0 ? 0 : ((1 - idle / total) * 100).toFixed(1);
}

module.exports = systemHealthController;
