const pool = require("../config/database");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

/**
 * Search Controller
 * Handles advanced search and saved searches
 */
const searchController = {
  /**
   * Advanced Search
   * @route POST /api/search/advanced
   */
  advancedSearch: catchAsync(async (req, res, next) => {
    const { search_type, filters } = req.body;

    if (search_type === "driver") {
      return await searchDrivers(filters, res, next);
    } else if (search_type === "payment") {
      return await searchPayments(filters, res, next);
    } else if (search_type === "audit") {
      return await searchAuditLogs(filters, res, next);
    } else if (search_type === "import") {
      return await searchImportLogs(filters, res, next);
    }

    throw new AppError("Invalid search type", 400);
  }),

  /**
   * Save Search
   * @route POST /api/search/save
   * @route POST /api/search/save
   */
  saveSearch: catchAsync(async (req, res, next) => {
    const { name, search_type, filters } = req.body;

    const [result] = await pool.query(
      "INSERT INTO saved_searches (user_id, name, search_type, filters) VALUES (?, ?, ?, ?)",
      [req.user.id, name, search_type, JSON.stringify(filters)]
    );

    res.json({
      success: true,
      message: "Search saved successfully",
      search_id: result.insertId,
    });
  }),

  /**
   * Get Saved Searches
   * @route GET /api/search/saved
   */
  getSavedSearches: catchAsync(async (req, res, next) => {
    const [searches] = await pool.query(
      "SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );

    res.json({
      success: true,
      searches,
    });
  }),

  /**
   * Delete Saved Search
   * @route DELETE /api/search/saved/:id
   */
  deleteSavedSearch: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM saved_searches WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: "Search deleted successfully",
    });
  }),

  /**
   * Execute Saved Search
   * @route POST /api/search/execute/:id
   */
  executeSearch: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const [searches] = await pool.query(
      "SELECT * FROM saved_searches WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (searches.length === 0) {
      throw new AppError("Search not found", 404);
    }

    const search = searches[0];
    const filters = JSON.parse(search.filters);

    // Execute the search
    req.body = { search_type: search.search_type, filters };
    return await searchController.advancedSearch(req, res, next);
  }),
};

// Helper function: Search Drivers
const searchDrivers = catchAsync(async (filters, res, next) => {
  const {
    name,
    driver_id,
    phone,
    verified,
    tin,
    page = 1,
    limit = 50,
  } = filters;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereConditions = [];
  const params = [];

  if (name) {
    whereConditions.push("d.full_name LIKE ?");
    params.push(`%${name}%`);
  }

  if (driver_id) {
    whereConditions.push("d.driver_id LIKE ?");
    params.push(`%${driver_id}%`);
  }

  if (phone) {
    whereConditions.push("d.phone_number LIKE ?");
    params.push(`%${phone}%`);
  }

  if (verified !== undefined && verified !== "") {
    whereConditions.push("d.verified = ?");
    params.push(verified === "true" || verified === true);
  }

  if (tin) {
    whereConditions.push("d.tin LIKE ?");
    params.push(`%${tin}%`);
  }

  const whereClause =
    whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

  // Get drivers
  const [drivers] = await pool.query(
    `SELECT d.*, 
      COUNT(b.id) as bonus_count,
      SUM(COALESCE(b.final_payout, b.net_payout)) as total_bonuses
     FROM drivers d
     LEFT JOIN bonuses b ON d.driver_id = b.driver_id
     ${whereClause}
     GROUP BY d.id
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  // Get total count
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM drivers d ${whereClause}`,
    params
  );

  res.json({
    success: true,
    search_type: "driver",
    results: drivers,
    total: countResult[0].total,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// Helper function: Search Payments
const searchPayments = catchAsync(async (filters, res, next) => {
  const {
    driver_name,
    driver_id,
    status,
    payment_method,
    start_date,
    end_date,
    min_amount,
    max_amount,
    page = 1,
    limit = 50,
  } = filters;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereConditions = [];
  const params = [];

  if (driver_name) {
    whereConditions.push("d.full_name LIKE ?");
    params.push(`%${driver_name}%`);
  }

  if (driver_id) {
    whereConditions.push("p.driver_id LIKE ?");
    params.push(`%${driver_id}%`);
  }

  if (status) {
    whereConditions.push("p.status = ?");
    params.push(status);
  }

  if (payment_method) {
    whereConditions.push("p.payment_method = ?");
    params.push(payment_method);
  }

  if (start_date && end_date) {
    whereConditions.push("p.payment_date BETWEEN ? AND ?");
    params.push(start_date, end_date);
  }

  if (min_amount) {
    whereConditions.push("p.total_amount >= ?");
    params.push(parseFloat(min_amount));
  }

  if (max_amount) {
    whereConditions.push("p.total_amount <= ?");
    params.push(parseFloat(max_amount));
  }

  const whereClause =
    whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

  // Get payments
  const [payments] = await pool.query(
    `SELECT p.*, d.full_name as driver_name, d.phone_number, u.full_name as processed_by_name
     FROM payments p
     LEFT JOIN drivers d ON p.driver_id = d.driver_id
     LEFT JOIN users u ON p.processed_by = u.id
     ${whereClause}
     ORDER BY p.payment_date DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  // Get total count
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM payments p LEFT JOIN drivers d ON p.driver_id = d.driver_id ${whereClause}`,
    params
  );

  res.json({
    success: true,
    search_type: "payment",
    results: payments,
    total: countResult[0].total,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// Helper function: Search Audit Logs
const searchAuditLogs = catchAsync(async (filters, res, next) => {
  const {
    user_id,
    action,
    entity_type,
    start_date,
    end_date,
    page = 1,
    limit = 50,
  } = filters;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereConditions = [];
  const params = [];

  if (user_id) {
    whereConditions.push("al.user_id = ?");
    params.push(user_id);
  }

  if (action) {
    whereConditions.push("al.action LIKE ?");
    params.push(`%${action}%`);
  }

  if (entity_type) {
    whereConditions.push("al.entity_type = ?");
    params.push(entity_type);
  }

  if (start_date && end_date) {
    whereConditions.push("al.created_at BETWEEN ? AND ?");
    params.push(start_date, end_date);
  }

  const whereClause =
    whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

  // Get audit logs
  const [logs] = await pool.query(
    `SELECT al.*, u.full_name as user_name, u.email as user_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  // Get total count
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
    params
  );

  res.json({
    success: true,
    search_type: "audit",
    results: logs,
    total: countResult[0].total,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// Helper function: Search Import Logs
const searchImportLogs = catchAsync(async (filters, res, next) => {
  const {
    imported_by,
    start_date,
    end_date,
    status,
    page = 1,
    limit = 50,
  } = filters;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereConditions = [];
  const params = [];

  if (imported_by) {
    whereConditions.push("il.imported_by = ?");
    params.push(imported_by);
  }

  if (start_date && end_date) {
    whereConditions.push("il.imported_at BETWEEN ? AND ?");
    params.push(start_date, end_date);
  }

  if (status) {
    whereConditions.push("il.status = ?");
    params.push(status);
  }

  const whereClause =
    whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

  // Get import logs
  const [logs] = await pool.query(
    `SELECT il.*, u.full_name as imported_by_name
     FROM import_logs il
     LEFT JOIN users u ON il.imported_by = u.id
     ${whereClause}
     ORDER BY il.imported_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  // Get total count
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM import_logs il ${whereClause}`,
    params
  );

  res.json({
    success: true,
    search_type: "import",
    results: logs,
    total: countResult[0].total,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

module.exports = searchController;
