const pool = require("../config/database");
const AuditService = require("../services/auditService");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const paymentController = {
  recordPayment: catchAsync(async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        driver_id,
        // total_amount, // Ignored from body for security
        payment_date,
        payment_method,
        notes,
        bonus_period_start,
        bonus_period_end,
      } = req.body;

      if (!driver_id) {
        throw new AppError("Driver ID is required", 400);
      }

      // 1. Calculate the actual total from pending bonuses
      const [bonusRows] = await connection.query(
        "SELECT SUM(COALESCE(final_payout, calculated_net_payout)) as actual_total FROM bonuses WHERE driver_id = ? AND payment_id IS NULL",
        [driver_id],
      );

      const actualTotal = parseFloat(bonusRows[0].actual_total || 0);

      if (actualTotal === 0) {
        throw new AppError("No pending bonuses found for this driver", 400);
      }

      // 2. Record the payment using the CALCULATED total
      const [result] = await connection.query(
        `INSERT INTO payments 
        (driver_id, total_amount, payment_date, payment_method, notes, bonus_period_start, bonus_period_end, processed_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          driver_id,
          actualTotal,
          payment_date || new Date(),
          payment_method,
          notes,
          bonus_period_start,
          bonus_period_end,
          req.user.id,
        ],
      );

      // 3. Link bonuses to payment (Clear them)
      await connection.query(
        "UPDATE bonuses SET payment_id = ? WHERE driver_id = ? AND payment_id IS NULL",
        [result.insertId, driver_id],
      );

      await AuditService.log(
        req.user.id,
        "Record Payment",
        "payment",
        result.insertId,
        { driver_id, total_amount: actualTotal },
      );

      await connection.commit();
      res.status(201).json({
        id: result.insertId,
        message: "Payment recorded and bonuses cleared",
        total_paid: actualTotal,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }),

  getHistory: catchAsync(async (req, res, next) => {
    const {
      driver_id,
      page = 1,
      limit = 25,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      method,
      status, // New: Allow status filtering
      sortBy = "payment_date",
      sortOrder = "DESC",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let whereClause = "";
    const params = [];

    // Default status handling: If no status provided, show both paid and processing
    if (status && status !== "All") {
      whereClause = " WHERE p.status = ?";
      params.push(status);
    } else {
      whereClause = " WHERE p.status IN ('paid', 'processing')";
    }

    // FILTERS
    if (driver_id) {
      whereClause += " AND p.driver_id LIKE ?";
      params.push(`%${driver_id}%`);
    }

    if (startDate) {
      whereClause += " AND p.payment_date >= ?";
      params.push(startDate);
    }

    if (endDate) {
      whereClause += " AND p.payment_date <= ?";
      params.push(`${endDate} 23:59:59`);
    }

    if (minAmount) {
      whereClause += " AND p.total_amount >= ?";
      params.push(parseFloat(minAmount));
    }

    if (maxAmount) {
      whereClause += " AND p.total_amount <= ?";
      params.push(parseFloat(maxAmount));
    }

    if (method && method !== "All") {
      whereClause += " AND p.payment_method = ?";
      params.push(method);
    }

    // SORTING
    const validColumns = [
      "payment_date",
      "total_amount",
      "driver_name",
      "driver_id",
    ];
    const sortColumn = validColumns.includes(sortBy) ? sortBy : "payment_date";
    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Get Total Count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM payments p
       LEFT JOIN drivers d ON p.driver_id = d.driver_id 
       ${whereClause}`,
      params,
    );

    // Get Paginated Data
    const query = `
      SELECT p.*, d.full_name as driver_name, u.full_name as processed_by_name 
      FROM payments p
      LEFT JOIN drivers d ON p.driver_id = d.driver_id
      LEFT JOIN users u ON p.processed_by = u.id
      ${whereClause}
      ORDER BY 
        ${
          sortColumn === "driver_name"
            ? "d.full_name"
            : sortColumn === "driver_id"
              ? "p.driver_id"
              : `p.${sortColumn}`
        } ${order}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [...params, limitNum, offset]);

    res.json({
      payments: rows,
      total: countRows[0].total,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total_pages: Math.ceil(countRows[0].total / limitNum),
      },
    });
  }),

  getPendingPayments: catchAsync(async (req, res, next) => {
    const { page = 1, limit = 25, q = "", status = "pending" } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Define where clause based on status
    let whereClause = "";
    if (status === "processing") {
      whereClause =
        "WHERE (d.verified = TRUE OR b.force_pay = TRUE) AND d.is_blocked = FALSE AND p.status = 'processing'";
    } else {
      // Default to 'pending' (bonuses with no payment_id yet)
      // Allow Verified OR Force Pay
      whereClause =
        "WHERE (d.verified = TRUE OR b.force_pay = TRUE) AND d.is_blocked = FALSE AND b.payment_id IS NULL";
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
    // Refactor: When status is 'processing', include the batch_id
    const query = `
      SELECT 
        d.driver_id, d.full_name, d.phone_number,
        COUNT(DISTINCT b.id) as pending_weeks,
        MIN(b.week_date) as earliest_bonus_date,
        MAX(b.week_date) as latest_bonus_date,
        SUM(COALESCE(b.final_payout, b.calculated_net_payout)) as total_pending_amount,
        COALESCE(p.status, 'pending') as status,
        p.batch_id
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

    // Get counts for both tabs to update UI badges
    const [pendingCount] = await pool.query(
      `SELECT COUNT(*) as count FROM (
         SELECT d.driver_id 
         FROM drivers d 
         JOIN bonuses b ON d.driver_id = b.driver_id 
         WHERE (d.verified = TRUE OR b.force_pay = TRUE) AND d.is_blocked = FALSE AND b.payment_id IS NULL
         GROUP BY d.driver_id
         HAVING SUM(COALESCE(b.final_payout, b.calculated_net_payout)) > 0
       ) as valid_drivers`,
    );

    const [processingCount] = await pool.query(
      `SELECT COUNT(DISTINCT d.driver_id) as count 
       FROM drivers d 
       JOIN bonuses b ON d.driver_id = b.driver_id 
       JOIN payments p ON b.payment_id = p.id
       WHERE (d.verified = TRUE OR b.force_pay = TRUE) AND d.is_blocked = FALSE AND p.status = 'processing'`,
    );

    res.json({
      pending_drivers: rows,
      total: countRows[0].total,
      counts: {
        pending: pendingCount[0].count,
        processing: processingCount[0].count,
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
          SUM(COALESCE(b.final_payout, b.calculated_net_payout)) as total_pending_amount,
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
          COALESCE(b.final_payout, b.calculated_net_payout) as amount,
          b.calculated_gross_payout,
          b.calculated_withholding_tax,
          d.phone_number,
          d.verified,
          b.force_pay
        FROM bonuses b
        JOIN drivers d ON b.driver_id = d.driver_id
        WHERE (d.verified = TRUE OR b.force_pay = TRUE) 
          AND d.is_blocked = FALSE 
          AND b.payment_id IS NULL
          AND COALESCE(b.final_payout, b.calculated_net_payout) > 0
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
            b.calculated_gross_payout,
            b.calculated_withholding_tax
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
  confirmPayment: catchAsync(async (req, res, next) => {
    const { paymentId } = req.params;
    const [result] = await pool.query(
      "UPDATE payments SET status = 'paid' WHERE id = ?",
      [paymentId],
    );

    if (result.affectedRows === 0) {
      throw new AppError("Payment not found", 404);
    }

    await AuditService.log(
      req.user.id,
      "Confirm Payment",
      "payment",
      paymentId,
      { status: "paid" },
    );
    res.json({ message: "Payment confirmed as Paid" });
  }),

  validateReconciliation: catchAsync(async (req, res, next) => {
    const ExcelJS = require("exceljs");
    const fs = require("fs");
    const path = require("path");

    if (!req.file) {
      throw new AppError("No file imported", 400);
    }

    const filePath = req.file.path;
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    const checklist = [
      { item: "File is readable", status: "passed", icon: "✅" },
      {
        item: "Header: 'Status' or 'TRANSACTION_STATUS' found",
        status: "failed",
        icon: "❌",
      },
      {
        item: "Header: 'WITHDRAWN' or 'Amount' found",
        status: "failed",
        icon: "❌",
      },
      {
        item: "Header: 'REMARK' or 'Comment' found",
        status: "failed",
        icon: "❌",
      },
      { item: "Contains payment records", status: "failed", icon: "❌" },
      {
        item: "Amounts match internal records",
        status: "passed",
        icon: "✅",
      },
    ];

    if (!worksheet) {
      checklist[0].status = "failed";
      checklist[0].icon = "❌";
      return res.json({
        success: false,
        checklist,
        message: "Excel file is empty or invalid.",
      });
    }

    // Metadata extraction (Dynamic based on labels)
    let bulkPlanId = null;
    let organizationName = null;

    // Check Row 1 for "Bulk Plan ID"
    const r1c1 = worksheet.getRow(1).getCell(1).value
      ? worksheet.getRow(1).getCell(1).value.toString().toLowerCase()
      : "";
    if (r1c1.includes("plan id")) {
      bulkPlanId = worksheet.getRow(2).getCell(1).value;
    }

    // Check Row 4 for "Organization Name"
    const r4c1 = worksheet.getRow(4).getCell(1).value
      ? worksheet.getRow(4).getCell(1).value.toString().toLowerCase()
      : "";
    if (r4c1.includes("organization")) {
      organizationName = worksheet.getRow(5).getCell(1).value;
    }

    // Find Header Row (Search first 20 rows)
    let headerRowIndex = -1;
    let amountCol = -1; // WITHDRAWN column
    let statusCol = -1; // TRANSACTION_STATUS column
    let commentCol = -1; // REMARK column
    let reasonCol = -1; // REASON_NAME for filtering

    for (let i = 1; i <= 20; i++) {
      const row = worksheet.getRow(i);
      let foundStatus = false;
      row.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().toLowerCase() : "";

        // Amount in WITHDRAWN column (new format) or "amount" (old format)
        if (val.includes("withdrawn") || val.includes("amount")) {
          amountCol = colNumber;
        }

        // Status column (new and old formats)
        if (val.includes("status") || val.includes("transaction_status")) {
          statusCol = colNumber;
          foundStatus = true;
        }

        // Metadata in REMARK or Comment
        if (
          val.includes("remark") ||
          val.includes("comment") ||
          val.includes("transaction details")
        ) {
          commentCol = colNumber;
        }

        // Filter column (REASON_NAME)
        if (val.includes("reason")) {
          reasonCol = colNumber;
        }
      });

      if (foundStatus) {
        headerRowIndex = i;
        checklist[1].status = "passed";
        checklist[1].icon = "✅";

        // Double check amount and comment in the SAME row
        const amountHeader = row.getCell(amountCol).value
          ? row.getCell(amountCol).value.toString().toLowerCase()
          : "";
        const commentHeader = row.getCell(commentCol).value
          ? row.getCell(commentCol).value.toString().toLowerCase()
          : "";

        if (
          amountHeader.includes("withdrawn") ||
          amountHeader.includes("amount")
        ) {
          checklist[2].status = "passed";
          checklist[2].icon = "✅";
        }
        if (
          commentHeader.includes("remark") ||
          commentHeader.includes("comment")
        ) {
          checklist[3].status = "passed";
          checklist[3].icon = "✅";
        }
        break;
      }
    }

    const summary = {
      totalRows: 0,
      validPayments: 0,
      unmatched: 0,
      alreadyPaid: 0,
      totalAmount: 0,
      unmatchedPhones: [], // Keep for backward compatibility
      unmatchedDetails: [], // NEW: Detailed unmatched info
      amountMismatches: [],
      invalidMetadata: [], // NEW: Metadata parsing errors
      skippedNonB2C: 0, // NEW: Count of filtered transactions
      metadata:
        bulkPlanId || organizationName
          ? {
              organization: organizationName,
              planId: bulkPlanId,
            }
          : null,
    };

    if (headerRowIndex === -1) {
      // Determine which columns are missing
      const missing = [];
      if (statusCol === -1) missing.push("Status/TRANSACTION_STATUS");
      if (amountCol === -1) missing.push("WITHDRAWN/Amount");
      if (commentCol === -1) missing.push("REMARK/Comment");

      return res.json({
        success: false,
        summary: { ...summary, metadata: null },
        checklist,
        message: `Missing required columns: ${missing.join(", ")}.

Please ensure your file contains these column headers:
 • Status column: 'TRANSACTION_STATUS' or 'Status'
 • Amount column: 'WITHDRAWN' or 'Amount'  
 • Metadata column: 'REMARK' or 'Comment'

This does not appear to be a valid Telebirr reconciliation file.`,
      });
    }

    // Process rows and extract metadata
    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > headerRowIndex) {
        const status = row.getCell(statusCol).value
          ? row.getCell(statusCol).value.toString().trim()
          : "";
        const amount = row.getCell(amountCol).value;
        const comment =
          commentCol !== -1 ? row.getCell(commentCol).value : null;
        const reason = reasonCol !== -1 ? row.getCell(reasonCol).value : null;

        // Filter by transaction type (only process "Bulk B2C Payment")
        if (reasonCol !== -1) {
          const reasonStr = reason ? reason.toString().trim() : "";
          if (reasonStr !== "Bulk B2C Payment") {
            // Skip non-B2C transactions and count them
            summary.skippedNonB2C++;
            return;
          }
        }

        // Process rows with valid status
        const normalizedStatus = status.toLowerCase();
        if (
          normalizedStatus === "completed" ||
          normalizedStatus === "success" ||
          normalizedStatus === "succeeded"
        ) {
          summary.totalRows++;
          rows.push({
            rowNumber,
            amount: parseFloat(amount || 0),
            comment: comment ? comment.toString() : null,
          });
        }
      }
    });

    if (summary.totalRows > 0) {
      checklist[4].status = "passed";
      checklist[4].icon = "✅";
    }

    for (const rowData of rows) {
      // Parse comment to extract bonus details
      // OLD Format: DriverID,BonusID,WeekDate,BatchID (comma-delimited)
      // NEW Format: DriverID.BonusID.WeekDate.BatchID (period-delimited)
      let driverId = null;
      let bonusId = null;
      let batchId = null;

      if (rowData.comment) {
        // Support both formats: comma and period delimiters
        let parts = [];
        if (rowData.comment.includes(",")) {
          parts = rowData.comment.split(",");
        } else if (rowData.comment.includes(".")) {
          parts = rowData.comment.split(".");
        }

        if (parts.length >= 4) {
          driverId = parts[0].trim();
          bonusId = parseInt(parts[1].trim());
          // weekDate = parts[2].trim(); // Not needed for matching
          batchId = parts[3].trim();
        } else if (parts.length > 0) {
          // Track metadata parsing errors with details
          summary.invalidMetadata.push({
            row: summary.totalRows,
            amount: rowData.amount,
            found: rowData.comment,
            expected:
              "DriverID.BonusID.WeekDate.BatchID or DriverID,BonusID,WeekDate,BatchID",
            reason: `Found ${parts.length} parts, expected 4`,
            suggestion:
              "Ensure the REMARK column contains metadata in the correct format",
          });
        }
      }

      // STRICT MODE: If we can't parse the metadata from the comment, we CANNOT match.
      if (!driverId || !bonusId) {
        summary.unmatched++;
        summary.unmatchedPhones.push(
          `Row ${rowData.rowNumber}, Amount: ${rowData.amount} ETB (Missing/Invalid Metadata)`,
        );
        summary.unmatchedDetails.push({
          row: summary.totalRows,
          amount: rowData.amount,
          reason: !rowData.comment
            ? "Missing metadata (REMARK column is empty)"
            : "Invalid metadata format",
          metadata: rowData.comment || "(empty)",
          suggestion:
            "Ensure this payment was exported from the correct batch file with metadata included",
        });
        continue;
      }

      // Find the specific bonus and its payment
      const [bonusPayment] = await pool.query(
        `SELECT 
          b.id as bonus_id,
          b.driver_id,
          p.id as payment_id,
          p.total_amount,
          p.status,
          p.batch_id
        FROM bonuses b
        LEFT JOIN payments p ON b.payment_id = p.id
        WHERE b.id = ? AND b.driver_id = ?`,
        [bonusId, driverId],
      );

      if (bonusPayment.length === 0) {
        summary.unmatched++;
        summary.unmatchedPhones.push(
          `Amount: ${rowData.amount} ETB, DriverID: ${driverId.substring(0, 10)}..., BonusID: ${bonusId}`,
        );
        summary.unmatchedDetails.push({
          row: summary.totalRows,
          amount: rowData.amount,
          reason: "Driver ID or Bonus ID not found in database",
          metadata: {
            driverId: driverId.substring(0, 12) + "...",
            bonusId,
            batchId,
          },
          suggestion: `Verify Driver ID '${driverId.substring(0, 12)}...' exists and Bonus ID ${bonusId} is correct in the system`,
        });
        continue;
      }

      const bonus = bonusPayment[0];

      // Check if payment is in processing status
      if (bonus.status !== "processing") {
        summary.alreadyPaid++;
        continue;
      }

      // Verify batch ID matches (if provided)
      if (batchId && bonus.batch_id !== batchId) {
        summary.unmatched++;
        summary.unmatchedPhones.push(
          `Amount: ${rowData.amount} ETB, DriverID: ${driverId.substring(0, 10)}..., BonusID: ${bonusId}`,
        );
        summary.unmatchedDetails.push({
          row: summary.totalRows,
          amount: rowData.amount,
          reason: "Batch ID mismatch",
          metadata: {
            fileBatchId: batchId,
            dbBatchId: bonus.batch_id,
            bonusId,
          },
          suggestion: `This payment belongs to batch '${bonus.batch_id}', not '${batchId}'. Upload the correct batch file.`,
        });
        continue;
      }

      // Compare amounts (should match exactly for individual bonus)
      const dbAmount = parseFloat(bonus.total_amount);
      if (Math.abs(dbAmount - rowData.amount) > 0.01) {
        const difference = Math.abs(dbAmount - rowData.amount);
        summary.amountMismatches.push({
          row: summary.totalRows,
          driverId: driverId.substring(0, 12) + "...",
          bonusId: bonusId,
          fileAmount: rowData.amount,
          dbAmount: dbAmount,
          difference: difference.toFixed(2),
          suggestion: `Expected ${dbAmount.toFixed(2)} ETB, found ${rowData.amount.toFixed(2)} ETB (difference: ${difference.toFixed(2)} ETB). Verify the amount in Telebirr system.`,
        });
        checklist[5].status = "failed";
        checklist[5].icon = "❌";
      } else {
        summary.validPayments++;
        summary.totalAmount += rowData.amount;
      }
    }

    // Fix: Disable caching to prevent 304 Not Modified responses on re-validation
    res.set("Cache-Control", "no-store");

    // Strict Mode: Fail if ANY check fails (Structure or Amount Mismatch)
    const isOverallSuccess = checklist.every((c) => c.status === "passed");

    let responseMessage = null;
    if (!isOverallSuccess && summary.amountMismatches.length > 0) {
      responseMessage = `Amount mismatch detected for ${summary.amountMismatches.length} records. Please fix the file before proceeding.`;
    } else if (!isOverallSuccess) {
      responseMessage =
        "Validation failed. Please review the checklist errors.";
    }

    // Fix: Create persistent copy BEFORE response
    // Use a unique name to prevent collisions and ensure persistence
    const importDir = path.join(__dirname, "../../imports"); // Absolute path
    const persistentFileName = "validated_" + req.file.filename;
    const persistentPath = path.join(importDir, persistentFileName);

    try {
      if (!fs.existsSync(persistentPath)) {
        fs.copyFileSync(req.file.path, persistentPath);
      }
    } catch (err) {
      console.error("Failed to persist reconciliation file:", err);
      // Fallback to original, but it might fail later
    }

    res.json({
      success: isOverallSuccess,
      summary,
      checklist,
      message: responseMessage,
      tempFileName: persistentFileName, // Return the persistent name
    });
  }),

  processReconciliation: catchAsync(async (req, res, next) => {
    const ExcelJS = require("exceljs");
    const fs = require("fs");
    const path = require("path");

    const fileName = req.body.fileName;
    if (!fileName) {
      throw new AppError("File name is required", 400);
    }

    const importDir = path.join(__dirname, "../../imports");
    const filePath = path.join(importDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new AppError(
        "Reconciliation file not found. Please import again.",
        400,
      );
    }

    // Fix #4: Add database transaction
    const connection = await pool.getConnection();
    const workbook = new ExcelJS.Workbook();

    try {
      await connection.beginTransaction();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.getWorksheet(1);

      const results = { success: 0, failed: 0 };
      const stats = {
        reconciled: 0,
        failed: 0,
        alreadyPaid: 0,
        totalAmount: 0,
      };

      let headerRowIndex = -1;
      let amountCol = -1;
      let statusCol = -1;
      let commentCol = -1;
      let reasonCol = -1;
      let receiptCol = -1; // NEW: Receipt number column

      for (let i = 1; i <= 20; i++) {
        const row = worksheet.getRow(i);
        let foundStatus = false;
        row.eachCell((cell, colNumber) => {
          const val = cell.value ? cell.value.toString().toLowerCase() : "";

          // Amount in WITHDRAWN column (new format) or "amount" (old format)
          if (val.includes("withdrawn") || val.includes("amount")) {
            amountCol = colNumber;
          }

          // Status column (new and old formats)
          if (val.includes("status") || val.includes("transaction_status")) {
            statusCol = colNumber;
            foundStatus = true;
          }

          // Metadata in REMARK or Comment
          if (
            val.includes("remark") ||
            val.includes("comment") ||
            val.includes("transaction details")
          ) {
            commentCol = colNumber;
          }

          // Filter column (REASON_NAME)
          if (val.includes("reason")) {
            reasonCol = colNumber;
          }

          // Receipt number column (RECEIPT_NO)
          if (val.includes("receipt")) {
            receiptCol = colNumber;
          }
        });

        if (foundStatus) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new AppError(
          "Could not find headers in reconciliation file.",
          400,
        );
      }

      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > headerRowIndex) {
          const status = row.getCell(statusCol).value
            ? row.getCell(statusCol).value.toString().trim().toLowerCase()
            : "";
          const comment =
            commentCol !== -1 ? row.getCell(commentCol).value : null;
          const reason = reasonCol !== -1 ? row.getCell(reasonCol).value : null;
          const receipt =
            receiptCol !== -1 ? row.getCell(receiptCol).value : null;

          // Filter by transaction type (only process "Bulk B2C Payment")
          if (reasonCol !== -1) {
            const reasonStr = reason ? reason.toString().trim() : "";
            if (reasonStr !== "Bulk B2C Payment") {
              return;
            }
          }

          if (
            status === "completed" ||
            status === "success" ||
            status === "succeeded"
          ) {
            rows.push({
              comment: comment ? comment.toString() : null,
              receipt: receipt ? receipt.toString() : null, // NEW: Store receipt
            });
          }
        }
      });

      for (const rowData of rows) {
        // Added loop for rows
        try {
          // Parse comment to extract bonus details
          // Format: DriverID,BonusID,WeekDate,BatchID
          let driverId = null;
          let bonusId = null;
          let batchId = null;

          if (rowData.comment) {
            let parts = [];
            // Support both formats: comma and period delimiters
            if (rowData.comment.includes(",")) {
              parts = rowData.comment.split(",");
            } else if (rowData.comment.includes(".")) {
              parts = rowData.comment.split(".");
            }

            if (parts.length >= 2) {
              driverId = parts[0].trim();
              bonusId = parseInt(parts[1].trim());
              if (parts.length >= 4) {
                batchId = parts[3].trim();
              }
            }
          }

          // STRICT MODE: If comment parsing failed, we SKIP.
          // No phone fallback allowed.
          if (!driverId || !bonusId) {
            results.failed++;
            stats.failed++;
            continue;
          }

          // Find the specific bonus payment
          const [bonusPayment] = await connection.query(
            `SELECT 
              p.id as payment_id,
              p.batch_internal_id,
              p.status,
              b.driver_id
            FROM bonuses b
            JOIN payments p ON b.payment_id = p.id
            WHERE b.id = ? AND b.driver_id = ?`,
            [bonusId, driverId],
          );

          if (bonusPayment.length > 0) {
            const payment = bonusPayment[0];

            // Only update if status is processing
            if (payment.status === "processing") {
              // Get payment amount and current notes for stats and appending
              const [paymentDetails] = await connection.query(
                "SELECT total_amount, notes FROM payments WHERE id = ?",
                [payment.payment_id],
              );
              const paymentAmount =
                paymentDetails.length > 0
                  ? parseFloat(paymentDetails[0].total_amount || 0)
                  : 0;
              const currentNotes =
                paymentDetails.length > 0 ? paymentDetails[0].notes || "" : "";

              // Append receipt number to notes if available
              let updatedNotes = currentNotes;
              if (rowData.receipt) {
                const receiptNote = `Receipt: ${rowData.receipt}`;
                updatedNotes = currentNotes
                  ? `${currentNotes}; ${receiptNote}`
                  : receiptNote;
              }

              await connection.query(
                "UPDATE payments SET status = 'paid', payment_date = NOW(), notes = ? WHERE id = ?",
                [updatedNotes, payment.payment_id],
              );

              // Update batch status if all payments in batch are paid
              if (payment.batch_internal_id) {
                const [remaining] = await connection.query(
                  "SELECT COUNT(*) as count FROM payments WHERE batch_internal_id = ? AND status != 'paid'",
                  [payment.batch_internal_id],
                );
                if (remaining[0].count === 0) {
                  await connection.query(
                    "UPDATE payment_batches SET status = 'paid' WHERE id = ?",
                    [payment.batch_internal_id],
                  );
                }
              }

              await AuditService.log(
                req.user.id,
                "Reconcile Payment",
                "payment",
                payment.payment_id,
                {
                  driver_id: payment.driver_id,
                  bonus_id: bonusId,
                  batch_id: batchId,
                },
              );
              results.success++;
              stats.reconciled++;
              stats.totalAmount += paymentAmount;
            } else if (payment.status === "paid") {
              // Already paid, count as skipped
              stats.alreadyPaid++;
            }
          } else {
            // Payment not found in DB
            results.failed++;
            stats.failed++;
          }
        } catch (err) {
          console.error("Error processing row:", err);
          results.failed++;
          stats.failed++;
        }
      }

      await connection.commit();

      // Return comprehensive statistics
      res.json({
        success: results.success > 0,
        message:
          results.success > 0
            ? `Successfully reconciled ${results.success} payment${
                results.success > 1 ? "s" : ""
              }`
            : "No payments were reconciled",
        reconciled: results.success,
        failed: results.failed,
        stats: {
          reconciled: stats.reconciled,
          failed: stats.failed,
          alreadyPaid: stats.alreadyPaid,
          totalProcessed: stats.reconciled + stats.failed + stats.alreadyPaid,
          totalAmount: stats.totalAmount,
        },
      });
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      // Fix #5: Ensure file cleanup in finally block
      if (connection) connection.release();
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error("Failed to cleanup file:", cleanupError);
        }
      }
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

  revertPayment: catchAsync(async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const { paymentId } = req.params;
      const { password } = req.body;

      if (!password) {
        throw new AppError("Password is required", 400);
      }

      // 1. Verify Password
      const [users] = await connection.query(
        "SELECT password_hash FROM users WHERE id = ?",
        [req.user.id],
      );

      const bcrypt = require("bcrypt");
      const isValid = await bcrypt.compare(password, users[0].password_hash);

      if (!isValid) {
        throw new AppError("Invalid password", 403);
      }

      // 2. Fetch Payment Details
      const [payments] = await connection.query(
        "SELECT * FROM payments WHERE id = ? AND status IN ('processing', 'paid')", // Allow paid too if needed, but mainly processing
        [paymentId],
      );

      if (payments.length === 0) {
        throw new AppError("Payment not found", 404);
      }

      const payment = payments[0];

      // 2. Full Revert Logic for Partial Payouts
      // Check if this payment involved 'force_pay' bonuses
      const [revertBonuses] = await connection.query(
        "SELECT id FROM bonuses WHERE payment_id = ? AND force_pay = TRUE",
        [paymentId],
      );

      if (revertBonuses.length > 0) {
        // A. Reset Bonuses (Clear final_payout and force_pay)
        await connection.query(
          "UPDATE bonuses SET final_payout = NULL, force_pay = FALSE WHERE payment_id = ?",
          [paymentId],
        );

        // B. Find and Void associated Additional Withholding Tax Debts
        // We find debts linked to these bonuses with reason 'Additional Withholding Tax'
        const bonusIds = revertBonuses.map((b) => b.id);
        const placeholder = bonusIds.map(() => "?").join(",");

        // Find penalty debts linked to these bonuses
        const [penaltyDebts] = await connection.query(
          `SELECT DISTINCT d.id 
           FROM driver_debts d
           JOIN bonus_deductions bd ON d.id = bd.debt_id
           WHERE bd.bonus_id IN (${placeholder}) AND d.reason = 'Additional Withholding Tax'`,
          [...bonusIds],
        );

        if (penaltyDebts.length > 0) {
          const debtIds = penaltyDebts.map((d) => d.id);
          const debtPlaceholder = debtIds.map(() => "?").join(",");

          // Delete Deduction Links
          await connection.query(
            `DELETE FROM bonus_deductions WHERE debt_id IN (${debtPlaceholder})`,
            [...debtIds],
          );

          // Delete/Void Debt Records
          await connection.query(
            `DELETE FROM driver_debts WHERE id IN (${debtPlaceholder})`,
            [...debtIds],
          );
        }
      }

      // 3. Unlink Bonuses (Set payment_id = NULL)
      // Standard unlink for all bonuses (even if just modified above)
      await connection.query(
        "UPDATE bonuses SET payment_id = NULL WHERE payment_id = ?",
        [paymentId],
      );

      // 3. Delete Payment Record
      await connection.query("DELETE FROM payments WHERE id = ?", [paymentId]);

      // 4. Update Batch Totals (if part of a batch)
      if (payment.batch_internal_id) {
        await connection.query(
          "UPDATE payment_batches SET total_amount = total_amount - ?, driver_count = driver_count - 1 WHERE id = ?",
          [payment.total_amount, payment.batch_internal_id],
        );
      }

      // 5. Audit Log
      await AuditService.log(
        req.user.id,
        "Revert Payment",
        "payment",
        paymentId,
        {
          driver_id: payment.driver_id,
          amount: payment.total_amount,
          batch_id: payment.batch_id,
        },
      );

      await connection.commit();
      res.json({ success: true, message: "Payment reverted successfully" });
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }),

  search: catchAsync(async (req, res, next) => {
    const { q, status, page = 1, limit = 25 } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 25;
    const offset = (pageNum - 1) * limitNum;

    const qStr = q ? `%${q}%` : "%";

    // Part 1: Actual payment records
    let pQuery = `
        SELECT 
            CAST(p.id AS CHAR) COLLATE utf8mb4_general_ci as id, 
            p.driver_id as driver_ref_id, 
            d.full_name, 
            p.status, 
            p.total_amount, 
            p.payment_date
        FROM payments p
        JOIN drivers d ON p.driver_id = d.driver_id
        WHERE (p.id LIKE ? OR d.full_name LIKE ? OR d.driver_id LIKE ?)
        ${status && status !== "all" ? "AND p.status = ?" : ""}
      `;
    let pParams = [qStr, qStr, qStr];
    if (status && status !== "all") pParams.push(status);

    // Part 2: Accumulated bonuses (floating pending)
    let aQuery = `
        SELECT 
            CONCAT('PEND-', d.driver_id) COLLATE utf8mb4_general_ci as id, 
            d.driver_id as driver_ref_id, 
            d.full_name, 
            'pending' COLLATE utf8mb4_general_ci as status, 
            SUM(COALESCE(b.final_payout, b.calculated_net_payout)) as total_amount, 
            MAX(b.week_date) as payment_date
        FROM drivers d
        JOIN bonuses b ON d.driver_id = b.driver_id
        WHERE b.payment_id IS NULL
        AND (d.full_name LIKE ? OR d.driver_id LIKE ?)
        GROUP BY d.driver_id
        HAVING total_amount > 0
      `;
    let aParams = [qStr, qStr];

    let finalSubQuery = "";
    let finalParams = [];

    if (!status || status === "all" || status === "pending") {
      finalSubQuery = `(${pQuery}) UNION ALL (${aQuery})`;
      finalParams = [...pParams, ...aParams];
    } else {
      finalSubQuery = pQuery;
      finalParams = pParams;
    }

    // Wrap for total count and pagination
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM (${finalSubQuery}) as t`,
      finalParams,
    );
    const total = countRows[0] ? countRows[0].total : 0;

    const [rows] = await pool.query(
      `SELECT * FROM (${finalSubQuery}) as t 
         ORDER BY payment_date DESC 
         LIMIT ? OFFSET ?`,
      [...finalParams, limitNum, offset],
    );

    res.json({
      payments: rows,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  }),
};

module.exports = paymentController;
