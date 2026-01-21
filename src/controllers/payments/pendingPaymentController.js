const pool = require("../../config/database");
const AuditService = require("../../services/auditService");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");

const pendingPaymentController = {
  getPendingPayments: catchAsync(async (req, res, next) => {
    const { page = 1, limit = 25, q = "", status = "pending" } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Define where clause based on status
    let whereClause = "";
    if (status === "processing") {
      whereClause =
        "WHERE (d.verified = TRUE OR b.force_pay = TRUE) AND d.is_blocked = FALSE AND d.is_telebirr_verified = TRUE AND p.status = 'processing'";
    } else if (status === "verification_needed") {
      // Drivers who are Verified (Docs) but NOT Telebirr Verified, and have pending bonuses
      whereClause =
        "WHERE d.verified = TRUE AND d.is_telebirr_verified = FALSE AND d.is_blocked = FALSE AND b.payment_id IS NULL";
    } else {
      // Default to 'pending' (bonuses with no payment_id yet)
      // Allow Verified OR Force Pay, AND Telebirr Verified
      whereClause =
        "WHERE (d.verified = TRUE OR b.force_pay = TRUE) AND d.is_blocked = FALSE AND d.is_telebirr_verified = TRUE AND b.payment_id IS NULL";
    }

    const params = [];

    if (q) {
      whereClause += " AND (d.full_name LIKE ? OR d.driver_id LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    // Get Total Count
    const [countRows] = await pool.query(
      `SELECT COUNT(DISTINCT d.driver_id) as total 
       FROM drivers d
       JOIN bonuses b ON d.driver_id = b.driver_id
       LEFT JOIN payments p ON b.payment_id = p.id
       ${whereClause}`,
      params,
    );

    // Get Paginated Data
    const query = `
      SELECT 
        d.driver_id, d.full_name, d.phone_number,
        COUNT(DISTINCT b.id) as pending_weeks,
        MIN(b.week_date) as earliest_bonus_date,
        MAX(b.week_date) as latest_bonus_date,
        SUM(COALESCE(b.final_payout, b.net_payout)) as total_pending_amount,
        COALESCE(p.status, 'pending') as status,
        p.batch_id,
        (SELECT dp.phone_number FROM driver_phones dp WHERE dp.driver_id = d.driver_id AND dp.status = 'pending' ORDER BY dp.added_at DESC LIMIT 1) as pending_phone
      FROM drivers d
      JOIN bonuses b ON d.driver_id = b.driver_id
      LEFT JOIN payments p ON b.payment_id = p.id
      ${whereClause}
      GROUP BY d.driver_id, p.status, p.batch_id
      HAVING total_pending_amount > 0
      ORDER BY total_pending_amount DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(query, [...params, limitNum, offset]);

    // Get counts for tabs
    const [pendingCount] = await pool.query(
      `SELECT COUNT(*) as count FROM (
         SELECT d.driver_id 
         FROM drivers d 
         JOIN bonuses b ON d.driver_id = b.driver_id 
         WHERE (d.verified = TRUE OR b.force_pay = TRUE) AND d.is_blocked = FALSE AND d.is_telebirr_verified = TRUE AND b.payment_id IS NULL
         GROUP BY d.driver_id
         HAVING SUM(COALESCE(b.final_payout, b.net_payout)) > 0
       ) as valid_drivers`,
    );

    const [processingCount] = await pool.query(
      `SELECT COUNT(DISTINCT d.driver_id) as count 
       FROM drivers d 
       JOIN bonuses b ON d.driver_id = b.driver_id 
       JOIN payments p ON b.payment_id = p.id
       WHERE (d.verified = TRUE OR b.force_pay = TRUE) AND d.is_blocked = FALSE AND d.is_telebirr_verified = TRUE AND p.status = 'processing'`,
    );

    const [verificationNeededCount] = await pool.query(
      `SELECT COUNT(DISTINCT d.driver_id) as count 
        FROM drivers d 
        JOIN bonuses b ON d.driver_id = b.driver_id 
        WHERE d.verified = TRUE AND d.is_telebirr_verified = FALSE AND d.is_blocked = FALSE AND b.payment_id IS NULL
        GROUP BY d.driver_id
        HAVING SUM(COALESCE(b.final_payout, b.net_payout)) > 0`,
    );

    // verificationNeededCount might return multiple rows (one per driver), we want total rows
    const verificationCountVal = verificationNeededCount.length;

    res.json({
      pending_drivers: rows,
      total: countRows[0].total,
      counts: {
        pending: pendingCount[0].count,
        processing: processingCount[0].count,
        verification_needed: verificationCountVal,
      },
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total_pages: Math.ceil(countRows[0].total / limitNum),
      },
    });
  }),

  getAccumulatedPayments: catchAsync(async (req, res, next) => {
    const { page = 1, limit = 25, q = "" } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let whereClause = "WHERE d.verified = FALSE AND b.payment_id IS NULL";
    const params = [];

    if (q) {
      whereClause += " AND (d.full_name LIKE ? OR d.driver_id LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    // Get Total Count
    const [countRows] = await pool.query(
      `SELECT COUNT(DISTINCT d.driver_id) as total 
       FROM drivers d
       JOIN bonuses b ON d.driver_id = b.driver_id
       ${whereClause}`,
      params,
    );

    const query = `
      SELECT 
          d.driver_id, 
          d.full_name, 
          d.phone_number,
          COUNT(b.id) as pending_weeks,
          SUM(COALESCE(b.final_payout, b.net_payout)) as total_pending_amount,
          MIN(b.week_date) as earliest_bonus_date,
          MAX(b.week_date) as latest_bonus_date
      FROM drivers d
      JOIN bonuses b ON d.driver_id = b.driver_id
      ${whereClause}
      GROUP BY d.driver_id, d.full_name, d.phone_number
      ORDER BY total_pending_amount DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(query, [...params, limitNum, offset]);

    res.json({
      accumulated_drivers: rows,
      total: countRows[0].total,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total_pages: Math.ceil(countRows[0].total / limitNum),
      },
    });
  }),

  exportPendingPayments: catchAsync(async (req, res, next) => {
    // Fix #9: Validate user authentication
    if (!req.user || !req.user.id) {
      throw new AppError("Authentication required for export", 401);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Pending Payments");

      // 1. Identify all INDIVIDUAL bonuses that are pending (never exported)
      // Changed from driver-level to bonus-level for proper tax calculation
      const [bonuses] = await connection.query(`
        SELECT 
          b.id as bonus_id,
          b.driver_id,
          b.week_date,
          COALESCE(b.final_payout, b.net_payout) as amount,
          b.gross_payout,
          b.withholding_tax,
          d.phone_number,
          d.verified,
          b.force_pay
        FROM bonuses b
        JOIN drivers d ON b.driver_id = d.driver_id
        WHERE (d.verified = TRUE OR b.force_pay = TRUE) 
          AND d.is_blocked = FALSE 
          AND d.is_telebirr_verified = TRUE
          AND b.payment_id IS NULL
          AND COALESCE(b.final_payout, b.net_payout) > 0
        ORDER BY d.driver_id, b.week_date
      `);

      if (bonuses.length === 0) {
        throw new AppError(
          "No fresh pending bonuses to export. If you need to re-download a previous export, please check the Export History.",
          400,
        );
      }

      // Count unique drivers for batch metadata
      const uniqueDrivers = [...new Set(bonuses.map((b) => b.driver_id))];

      // Generate a unique Batch ID with timestamp and incremental suffix for display
      const now = new Date();
      const dateStr = `${now.getFullYear()}${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;
      const timeStr = `${now.getHours().toString().padStart(2, "0")}${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      // Get sequence for today
      const [countResult] = await connection.query(
        "SELECT COUNT(*) as count FROM payment_batches WHERE DATE(exported_at) = CURRENT_DATE",
      );
      const sequence = (countResult[0].count + 1).toString().padStart(5, "0");

      const batchDisplayId = `BATCH-${dateStr}-${timeStr}-${sequence}`;

      // Create the internal batch record first
      const [batchResult] = await connection.query(
        "INSERT INTO payment_batches (batch_id, total_amount, driver_count, status, exported_by) VALUES (?, ?, ?, ?, ?)",
        [batchDisplayId, 0, uniqueDrivers.length, "processing", req.user.id],
      );
      const batchInternalId = batchResult.insertId;

      let totalBatchAmount = 0;

      // 2. Process each BONUS individually (not by driver)
      // This ensures proper withholding tax calculation per bonus
      for (const bonus of bonuses) {
        if (!bonus.phone_number || bonus.phone_number.trim() === "") {
          throw new AppError(
            `Driver ${bonus.driver_id} (Bonus ID: ${bonus.bonus_id}) has no phone number. Cannot export.`,
            400,
          );
        }

        // Create ONE payment per bonus
        const [pResult] = await connection.query(
          "INSERT INTO payments (driver_id, total_amount, payment_date, payment_method, status, processed_by, notes, batch_id, batch_internal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            bonus.driver_id,
            bonus.amount,
            now,
            "Telebirr",
            "processing",
            req.user.id,
            `Bonus ${bonus.week_date} in ${batchDisplayId}`,
            batchDisplayId,
            batchInternalId,
          ],
        );
        const paymentId = pResult.insertId;

        // Link THIS specific bonus to this payment (one-to-one)
        await connection.query(
          "UPDATE bonuses SET payment_id = ? WHERE id = ?",
          [paymentId, bonus.bonus_id],
        );

        // Ensure amount is treated as number, not string
        totalBatchAmount += parseFloat(bonus.amount);
      }

      // Update the batch summary
      await connection.query(
        "UPDATE payment_batches SET total_amount = ? WHERE id = ?",
        [totalBatchAmount, batchInternalId],
      );

      // 3. Fetch data for this SPECIFIC BATCH for Excel generation
      // Now returns ONE ROW PER BONUS
      const [exportRows] = await connection.query(
        `
        SELECT 
            b.id as bonus_id,
            b.driver_id,
            b.week_date,
            d.phone_number,
            p.total_amount,
            b.gross_payout,
            b.withholding_tax
        FROM bonuses b
        JOIN drivers d ON b.driver_id = d.driver_id
        JOIN payments p ON b.payment_id = p.id
        WHERE p.batch_internal_id = ?
        ORDER BY d.driver_id, b.week_date
      `,
        [batchInternalId],
      );

      // Validate all phone numbers
      for (const row of exportRows) {
        const rawPhone = row.phone_number || "";
        const digits = rawPhone.replace(/\D/g, "");
        const phone = digits.length >= 9 ? digits.slice(-9) : digits;

        if (phone.length !== 9 || !/^\d{9}$/.test(phone)) {
          throw new AppError(
            `Invalid phone for driver ${row.driver_id} (Bonus ID: ${row.bonus_id}). Phone '${rawPhone}' needs attention.`,
            400,
          );
        }
      }

      const tableData = exportRows.map((row) => {
        // Robust phone number cleaning - extract only digits
        const rawPhone = row.phone_number || "";
        const digits = rawPhone.replace(/\D/g, ""); // Remove ALL non-digits
        const phone = digits.length >= 9 ? digits.slice(-9) : digits;

        // Format: DriverID,BonusID,WeekDate,BatchID
        const date = new Date(row.week_date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const formattedDate = `${year}-${month}-${day}`;

        const comment = `${row.driver_id},${row.bonus_id},${formattedDate},${batchDisplayId}`;

        return ["MSISDN", phone, "", parseFloat(row.total_amount), comment];
      });

      // Add Table with style and filters
      worksheet.addTable({
        name: "PendingPaymentsTable",
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium2",
          showRowStripes: true,
        },
        columns: [
          { name: "IdentifierType", filterButton: true },
          { name: "IdentifierValue", filterButton: true },
          { name: "Validation KYC value(O)", filterButton: true },
          { name: "Amount", filterButton: true },
          { name: "Comment", filterButton: true },
        ],
        rows: tableData,
      });

      worksheet.getColumn(1).width = 15;
      worksheet.getColumn(2).width = 18;
      worksheet.getColumn(3).width = 25;
      worksheet.getColumn(4).width = 15;
      worksheet.getColumn(5).width = 50;
      worksheet.getColumn(4).numFmt = "#,##0.00";
      worksheet.getColumn(1).alignment = { horizontal: "center" };
      worksheet.getColumn(2).alignment = { horizontal: "left" };
      worksheet.getColumn(4).alignment = { horizontal: "right" };

      // Fix #2: Add audit logging
      await AuditService.log(
        req.user.id,
        "Export Pending Payments",
        "payment",
        null,
        {
          batchId: batchDisplayId,
          driverCount: exportRows.length,
          totalAmount: totalBatchAmount,
        },
      );

      await connection.commit();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=" +
          "G2G_PAYMENTS_" +
          new Date().toISOString().split("T")[0] +
          ".xlsx",
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }),

  getBatches: catchAsync(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [batches] = await pool.query(
      `SELECT b.*, u.full_name as exported_by_name,
                (SELECT COUNT(*) FROM payments WHERE batch_internal_id = b.id AND status = 'paid') as paid_count,
                (SELECT COUNT(*) FROM payments WHERE batch_internal_id = b.id) as num_payments
         FROM payment_batches b 
         LEFT JOIN users u ON b.exported_by = u.id 
         ORDER BY b.exported_at DESC 
         LIMIT ? OFFSET ?`,
      [limitNum, offset],
    );

    const [countRows] = await pool.query(
      "SELECT COUNT(*) as total FROM payment_batches",
    );

    res.json({
      batches,
      pagination: {
        page: parseInt(page),
        total: countRows[0].total,
        total_pages: Math.ceil(countRows[0].total / limitNum),
      },
    });
  }),

  downloadBatchExcel: catchAsync(async (req, res, next) => {
    const { batchId } = req.params;

    // Get batch metadata
    const [batchRows] = await pool.query(
      "SELECT * FROM payment_batches WHERE batch_id = ?",
      [batchId],
    );

    if (batchRows.length === 0) {
      throw new AppError("Batch not found", 404);
    }

    const batch = batchRows[0];

    // Get payments for this batch
    const [exportRows] = await pool.query(
      `
        SELECT 
            d.driver_id, 
            d.phone_number,
            p.total_amount
        FROM drivers d
        JOIN payments p ON d.driver_id = p.driver_id
        WHERE p.batch_internal_id = ?
        ORDER BY p.total_amount DESC
      `,
      [batch.id],
    );

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Pending Payments");

    const tableData = exportRows.map((row) => {
      const rawPhone = row.phone_number || "";
      const digits = rawPhone.replace(/\D/g, "");
      const phone = digits.length >= 9 ? digits.slice(-9) : digits;

      return [
        "MSISDN",
        phone,
        "",
        parseFloat(row.total_amount),
        `${row.driver_id},${batchId}`,
      ];
    });

    worksheet.addTable({
      name: "PendingPaymentsTable",
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium2",
        showRowStripes: true,
      },
      columns: [
        { name: "IdentifierType", filterButton: true },
        { name: "IdentifierValue", filterButton: true },
        { name: "Validation KYC value(O)", filterButton: true },
        { name: "Amount", filterButton: true },
        { name: "Comment", filterButton: true },
      ],
      rows: tableData,
    });

    worksheet.getColumn(1).width = 15;
    worksheet.getColumn(2).width = 18;
    worksheet.getColumn(3).width = 25;
    worksheet.getColumn(4).width = 15;
    worksheet.getColumn(5).width = 50;
    worksheet.getColumn(4).numFmt = "#,##0.00";
    worksheet.getColumn(1).alignment = { horizontal: "center" };
    worksheet.getColumn(2).alignment = { horizontal: "left" };
    worksheet.getColumn(4).alignment = { horizontal: "right" };

    const filename = `G2G_Batch_${batchId.replace(/-/g, "_")}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();
  }),
};

module.exports = pendingPaymentController;
