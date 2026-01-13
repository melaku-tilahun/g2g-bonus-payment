const pool = require("../config/database");
const catchAsync = require("../utils/catchAsync");

const dashboardController = {
  getStats: catchAsync(async (req, res, next) => {
    const today = new Date().toISOString().split("T")[0];

    // 1. Pending Amount & Growth
    const [pendingRows] = await pool.query(`
        SELECT SUM(net_payout) as total 
        FROM bonuses 
        WHERE payment_id IS NULL
      `);
    const totalPending = pendingRows[0].total || 0;

    // Calculate Growth (this month vs last month)
    const [growthRows] = await pool.query(`
        SELECT 
          SUM(CASE WHEN MONTH(imported_at) = MONTH(CURDATE()) AND YEAR(imported_at) = YEAR(CURDATE()) THEN net_payout ELSE 0 END) as this_month,
          SUM(CASE WHEN MONTH(imported_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(imported_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN net_payout ELSE 0 END) as last_month
        FROM bonuses
      `);

    const thisMonth = parseFloat(growthRows[0].this_month || 0);
    const lastMonth = parseFloat(growthRows[0].last_month || 0);
    let growthPercent = 0;
    if (lastMonth > 0) {
      growthPercent = ((thisMonth - lastMonth) / lastMonth) * 100;
    } else if (thisMonth > 0) {
      growthPercent = 100;
    }

    // 2. Unverified Drivers & New Today
    const [driverRows] = await pool.query(`
        SELECT 
          COUNT(*) as total_unverified,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as new_today
        FROM drivers 
        WHERE verified = FALSE
      `);
    const unverifiedCount = driverRows[0].total_unverified || 0;
    const newToday = driverRows[0].new_today || 0;

    // 3. Weekly Imports
    const [importRows] = await pool.query(`
        SELECT COUNT(*) as count 
        FROM import_logs 
        WHERE YEARWEEK(week_date, 1) = YEARWEEK(CURDATE(), 1)
      `);
    const weeklyImports = importRows[0].count || 0;

    res.json({
      pending_amount: totalPending,
      pending_growth: growthPercent.toFixed(1),
      unverified_drivers: unverifiedCount,
      new_drivers_today: newToday,
      weekly_imports: weeklyImports,
    });
  }),
};

module.exports = dashboardController;
