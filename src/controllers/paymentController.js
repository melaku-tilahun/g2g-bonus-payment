const pool = require("../config/database");
const AuditService = require("../services/auditService");

const paymentController = {
  recordPayment: async (req, res) => {
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
        return res.status(400).json({ message: "Driver ID is required" });
      }

      // 1. Calculate the actual total from pending bonuses
      const [bonusRows] = await connection.query(
        "SELECT SUM(net_payout) as actual_total FROM bonuses WHERE driver_id = ? AND payment_id IS NULL",
        [driver_id]
      );

      const actualTotal = parseFloat(bonusRows[0].actual_total || 0);

      if (actualTotal === 0) {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: "No pending bonuses found for this driver" });
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
        ]
      );

      // 3. Link bonuses to payment (Clear them)
      await connection.query(
        "UPDATE bonuses SET payment_id = ? WHERE driver_id = ? AND payment_id IS NULL",
        [result.insertId, driver_id]
      );

      await AuditService.log(
        req.user.id,
        "Record Payment",
        "payment",
        result.insertId,
        { driver_id, total_amount: actualTotal }
      );

      await connection.commit();
      res.status(201).json({
        id: result.insertId,
        message: "Payment recorded and bonuses cleared",
        total_paid: actualTotal,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Record payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    } finally {
      connection.release();
    }
  },

  getHistory: async (req, res) => {
    try {
      const { driver_id, page = 1, limit = 25 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      let whereClause = " WHERE p.status = 'paid'";
      const params = [];

      if (driver_id) {
        whereClause += " AND p.driver_id = ?";
        params.push(driver_id);
      }

      // Get Total Count
      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM payments p ${whereClause}`,
        params
      );

      // Get Paginated Data - Use LEFT JOIN to show payments even if driver/user is missing
      const query = `
        SELECT p.*, d.full_name as driver_name, u.full_name as processed_by_name 
        FROM payments p
        LEFT JOIN drivers d ON p.driver_id = d.driver_id
        LEFT JOIN users u ON p.processed_by = u.id
        ${whereClause}
        ORDER BY p.payment_date DESC
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
    } catch (error) {
      console.error("Get payment history error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getPendingPayments: async (req, res) => {
    try {
      const { page = 1, limit = 25, q = "", status = "pending" } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // Define where clause based on status
      let whereClause = "";
      if (status === "processing") {
        whereClause = "WHERE d.verified = TRUE AND p.status = 'processing'";
      } else {
        // Default to 'pending' (bonuses with no payment_id yet)
        whereClause = "WHERE d.verified = TRUE AND b.payment_id IS NULL";
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
        params
      );

      // Get Paginated Data
      // Refactor: When status is 'processing', include the batch_id
      const query = `
        SELECT 
          d.driver_id, d.full_name, d.phone_number,
          COUNT(DISTINCT b.id) as pending_weeks,
          MIN(b.week_date) as earliest_bonus_date,
          MAX(b.week_date) as latest_bonus_date,
          SUM(b.net_payout) as total_pending_amount,
          COALESCE(p.status, 'pending') as status,
          p.batch_id
        FROM drivers d
        JOIN bonuses b ON d.driver_id = b.driver_id
        LEFT JOIN payments p ON b.payment_id = p.id
        ${whereClause}
        GROUP BY d.driver_id, p.status, p.batch_id
        ORDER BY total_pending_amount DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await pool.query(query, [...params, limitNum, offset]);

      // Get counts for both tabs to update UI badges
      const [pendingCount] = await pool.query(
        `SELECT COUNT(DISTINCT d.driver_id) as count 
         FROM drivers d 
         JOIN bonuses b ON d.driver_id = b.driver_id 
         WHERE d.verified = TRUE AND b.payment_id IS NULL`
      );

      const [processingCount] = await pool.query(
        `SELECT COUNT(DISTINCT d.driver_id) as count 
         FROM drivers d 
         JOIN bonuses b ON d.driver_id = b.driver_id 
         JOIN payments p ON b.payment_id = p.id
         WHERE d.verified = TRUE AND p.status = 'processing'`
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
    } catch (error) {
      console.error("Get pending payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getAccumulatedPayments: async (req, res) => {
    try {
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
        params
      );

      const query = `
        SELECT 
            d.driver_id, 
            d.full_name, 
            d.phone_number,
            COUNT(b.id) as pending_weeks,
            SUM(b.net_payout) as total_pending_amount,
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
    } catch (error) {
      console.error("Get accumulated payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  exportPendingPayments: async (req, res) => {
    // Fix #9: Validate user authentication
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ message: "Authentication required for export" });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Pending Payments");

      // 1. Identify all drivers that have FRESH pending bonuses (never exported)
      const [drivers] = await connection.query(`
        SELECT DISTINCT d.driver_id, d.phone_number
        FROM drivers d
        JOIN bonuses b ON d.driver_id = b.driver_id
        WHERE d.verified = TRUE AND b.payment_id IS NULL
      `);

      if (drivers.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          message:
            "No fresh pending bonuses to export. If you need to re-download a previous export, please check the Export History.",
        });
      }

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
        "SELECT COUNT(*) as count FROM payment_batches WHERE DATE(exported_at) = CURRENT_DATE"
      );
      const sequence = (countResult[0].count + 1).toString().padStart(5, "0");

      const batchDisplayId = `BATCH-${dateStr}-${timeStr}-${sequence}`;

      // Create the internal batch record first
      const [batchResult] = await connection.query(
        "INSERT INTO payment_batches (batch_id, total_amount, driver_count, status, exported_by) VALUES (?, ?, ?, ?, ?)",
        [batchDisplayId, 0, drivers.length, "processing", req.user.id]
      );
      const batchInternalId = batchResult.insertId;

      let totalBatchAmount = 0;

      // 2. Process each driver: Create a new processing payment for this batch
      for (const driver of drivers) {
        if (!driver.phone_number || driver.phone_number.trim() === "") {
          await connection.rollback();
          return res.status(400).json({
            message: `Driver ${driver.driver_id} has no phone number. Cannot export.`,
          });
        }

        // Create new processing payment linked to THIS batch
        const [pResult] = await connection.query(
          "INSERT INTO payments (driver_id, total_amount, payment_date, payment_method, status, processed_by, notes, batch_id, batch_internal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            driver.driver_id,
            0,
            now,
            "Telebirr",
            "processing",
            req.user.id,
            `Isolated in ${batchDisplayId}`,
            batchDisplayId,
            batchInternalId,
          ]
        );
        const paymentId = pResult.insertId;

        // Link only the CURRENTLY UNLINKED bonuses for this driver to this payment
        // This is the CRITICAL isolation step
        await connection.query(
          "UPDATE bonuses SET payment_id = ? WHERE driver_id = ? AND payment_id IS NULL",
          [paymentId, driver.driver_id]
        );

        // Update the payment's total_amount
        const [sumResult] = await connection.query(
          "SELECT SUM(net_payout) as total FROM bonuses WHERE payment_id = ?",
          [paymentId]
        );
        const totalAmount = parseFloat(sumResult[0].total || 0);
        totalBatchAmount += totalAmount;

        await connection.query(
          "UPDATE payments SET total_amount = ? WHERE id = ?",
          [totalAmount, paymentId]
        );
      }

      // Update the batch summary
      await connection.query(
        "UPDATE payment_batches SET total_amount = ? WHERE id = ?",
        [totalBatchAmount, batchInternalId]
      );

      // 3. Fetch data for this SPECIFIC BATCH only for Excel generation
      const [exportRows] = await connection.query(
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
        [batchInternalId]
      );

      // Validate all phone numbers
      for (const row of exportRows) {
        const rawPhone = row.phone_number || "";
        const digits = rawPhone.replace(/\D/g, "");
        const phone = digits.length >= 9 ? digits.slice(-9) : digits;

        if (phone.length !== 9 || !/^\d{9}$/.test(phone)) {
          await connection.rollback();
          return res.status(400).json({
            message: `Invalid phone for driver ${row.driver_id}. Phone '${rawPhone}' needs attention.`,
          });
        }
      }

      const tableData = exportRows.map((row) => {
        // Robust phone number cleaning - extract only digits
        const rawPhone = row.phone_number || "";
        const digits = rawPhone.replace(/\D/g, ""); // Remove ALL non-digits
        const phone = digits.length >= 9 ? digits.slice(-9) : digits;

        return [
          "MSISDN",
          phone,
          "",
          parseFloat(row.total_amount),
          `${row.driver_id},${batchDisplayId}`,
        ];
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
        }
      );

      await connection.commit();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=" +
          "G2G_PAYMENTS_" +
          new Date().toISOString().split("T")[0] +
          ".xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Export pending payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    } finally {
      if (connection) connection.release();
    }
  },
  confirmPayment: async (req, res) => {
    try {
      const { paymentId } = req.params;
      const [result] = await pool.query(
        "UPDATE payments SET status = 'paid' WHERE id = ?",
        [paymentId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Payment not found" });
      }

      await AuditService.log(
        req.user.id,
        "Confirm Payment",
        "payment",
        paymentId,
        { status: "paid" }
      );
      res.json({ message: "Payment confirmed as Paid" });
    } catch (error) {
      console.error("Confirm payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  validateReconciliation: async (req, res) => {
    const ExcelJS = require("exceljs");
    const fs = require("fs");

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.getWorksheet(1);

      const checklist = [
        { item: "File is readable", status: "passed", icon: "✅" },
        { item: "Header: 'Credit Msisdn' found", status: "failed", icon: "❌" },
        { item: "Header: 'Amount' found", status: "failed", icon: "❌" },
        { item: "Header: 'Status' found", status: "failed", icon: "❌" },
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
      let phoneCol = 3; // Default C
      let amountCol = 8; // Default H
      let statusCol = 12; // Default L
      let commentCol = -1;

      for (let i = 1; i <= 20; i++) {
        const row = worksheet.getRow(i);
        let foundMsisdn = false;
        row.eachCell((cell, colNumber) => {
          const val = cell.value ? cell.value.toString().toLowerCase() : "";
          if (val.includes("msisdn")) {
            foundMsisdn = true;
            phoneCol = colNumber;
          }
          if (val.includes("amount")) amountCol = colNumber;
          if (val.includes("status")) statusCol = colNumber;
          if (val.includes("comment")) commentCol = colNumber;
        });

        if (foundMsisdn) {
          headerRowIndex = i;
          checklist[1].status = "passed";
          checklist[1].icon = "✅";

          // Double check amount and status in the SAME row
          const amountHeader = row.getCell(amountCol).value
            ? row.getCell(amountCol).value.toString().toLowerCase()
            : "";
          const statusHeader = row.getCell(statusCol).value
            ? row.getCell(statusCol).value.toString().toLowerCase()
            : "";

          if (amountHeader.includes("amount")) {
            checklist[2].status = "passed";
            checklist[2].icon = "✅";
          }
          if (statusHeader.includes("status")) {
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
        unmatchedPhones: [],
        amountMismatches: [], // New field
        metadata:
          bulkPlanId || organizationName
            ? {
                organization: organizationName,
                planId: bulkPlanId,
              }
            : null,
      };

      if (headerRowIndex === -1) {
        return res.json({
          success: false,
          summary: { ...summary, metadata: null }, // Explicitly nullify metadata on failure
          checklist,
          message:
            "Could not find 'Credit Msisdn' column. Please ensure this is a valid Telebirr Bulk Report.",
        });
      }

      const cleanPhone = (phone) => {
        if (!phone) return null;
        const str = phone.toString().replace(/\D/g, "");
        return str.length >= 9 ? str.slice(-9) : str;
      };

      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > headerRowIndex) {
          const phone = row.getCell(phoneCol).value;
          const status = row.getCell(statusCol).value
            ? row.getCell(statusCol).value.toString().trim()
            : "";
          const amount = row.getCell(amountCol).value;
          const comment =
            commentCol !== -1 ? row.getCell(commentCol).value : null;

          if (phone) {
            summary.totalRows++;
            // Accept "Completed", "Success", "Succeeded", etc.
            const normalizedStatus = status.toLowerCase();
            if (
              normalizedStatus === "completed" ||
              normalizedStatus === "success" ||
              normalizedStatus === "succeeded"
            ) {
              rows.push({
                phone: cleanPhone(phone),
                originalPhone: phone,
                amount: parseFloat(amount || 0),
                comment: comment ? comment.toString() : null,
              });
            }
          }
        }
      });

      if (summary.totalRows > 0) {
        checklist[4].status = "passed";
        checklist[4].icon = "✅";
      }

      for (const rowData of rows) {
        // Find driver by last 9 digits
        const [drivers] = await pool.query(
          "SELECT driver_id FROM drivers WHERE phone_number LIKE ?",
          [`%${rowData.phone}`]
        );

        if (drivers.length === 0) {
          summary.unmatched++;
          summary.unmatchedPhones.push(rowData.originalPhone);
          continue;
        }

        const driver = drivers[0];

        // EXTREMELY IMPORTANT: Extract Batch ID from comment if available
        let batchIdFromComment = null;
        if (rowData.comment && rowData.comment.includes(",")) {
          const parts = rowData.comment.split(",");
          if (parts.length >= 2) {
            batchIdFromComment = parts[1].trim();
          }
        }

        // Check for processing payments
        let payments;
        if (batchIdFromComment) {
          // Precise match by Batch ID
          [payments] = await pool.query(
            "SELECT id, total_amount FROM payments WHERE driver_id = ? AND batch_id = ? AND status = 'processing' LIMIT 1",
            [driver.driver_id, batchIdFromComment]
          );
        } else {
          // Fallback to latest processing
          [payments] = await pool.query(
            "SELECT id, total_amount FROM payments WHERE driver_id = ? AND status = 'processing' ORDER BY payment_date DESC LIMIT 1",
            [driver.driver_id]
          );
        }

        if (payments.length > 0) {
          const dbAmount = parseFloat(payments[0].total_amount);
          // Compare amounts
          if (Math.abs(dbAmount - rowData.amount) > 0.01) {
            summary.amountMismatches.push({
              phone: rowData.originalPhone,
              fileAmount: rowData.amount,
              dbAmount: dbAmount,
            });
            checklist[5].status = "failed";
            checklist[5].icon = "❌";
          } else {
            summary.validPayments++;
            summary.totalAmount += rowData.amount;
          }
        } else {
          summary.alreadyPaid++;
        }
      }

      const isOverallSuccess = checklist.every((c) => c.status === "passed");
      let responseMessage = null;
      if (!isOverallSuccess && summary.amountMismatches.length > 0) {
        responseMessage = `Amount mismatch detected for ${summary.amountMismatches.length} records. Please verify the report.`;
      }

      res.json({
        success: isOverallSuccess,
        summary,
        checklist,
        message: responseMessage,
        tempFileName: req.file.filename,
      });
    } catch (error) {
      console.error("Validation error:", error);
      res.status(400).json({ success: false, message: error.message });
    } finally {
      // In a real robust system, we might keep it for a few minutes.
      // For now, let's keep it if successful so the 'process' step can use it.
    }
  },

  processReconciliation: async (req, res) => {
    const ExcelJS = require("exceljs");
    const fs = require("fs");
    const path = require("path");

    const fileName = req.body.fileName;
    if (!fileName) {
      return res.status(400).json({ message: "File name is required" });
    }

    const filePath = path.join("uploads", fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        message: "Reconciliation file not found. Please upload again.",
      });
    }

    // Fix #4: Add database transaction
    const connection = await pool.getConnection();
    const workbook = new ExcelJS.Workbook();

    try {
      await connection.beginTransaction();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.getWorksheet(1);

      const results = { success: 0, failed: 0 };

      const cleanPhone = (phone) => {
        if (!phone) return null;
        const str = phone.toString().replace(/\D/g, "");
        return str.length >= 9 ? str.slice(-9) : str;
      };

      let headerRowIndex = -1;
      let phoneCol = 3;
      let statusCol = 12;

      for (let i = 1; i <= 20; i++) {
        const row = worksheet.getRow(i);
        let foundMsisdn = false;
        row.eachCell((cell, colNumber) => {
          const val = cell.value ? cell.value.toString().toLowerCase() : "";
          if (val.includes("msisdn")) {
            foundMsisdn = true;
            phoneCol = colNumber;
          }
          if (val.includes("status")) statusCol = colNumber;
        });
        if (foundMsisdn) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error("Could not find headers in reconciliation file.");
      }

      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > headerRowIndex) {
          const phone = row.getCell(phoneCol).value;
          const status = row.getCell(statusCol).value
            ? row.getCell(statusCol).value.toString().trim().toLowerCase()
            : "";
          const comment =
            commentCol !== -1 ? row.getCell(commentCol).value : null;

          if (
            phone &&
            (status === "completed" ||
              status === "success" ||
              status === "succeeded")
          ) {
            rows.push({
              phone: cleanPhone(phone),
              comment: comment ? comment.toString() : null,
            });
          }
        }
      });

      for (const rowData of rows) {
        // Added loop for rows
        try {
          // Identify Batch ID if possible
          let batchIdFromComment = null;
          if (rowData.comment && rowData.comment.includes(",")) {
            const parts = rowData.comment.split(",");
            if (parts.length >= 2) batchIdFromComment = parts[1].trim();
          }

          const [drivers] = await connection.query(
            "SELECT driver_id FROM drivers WHERE phone_number LIKE ?",
            [`%${rowData.phone}`]
          );

          if (drivers.length > 0) {
            const driver = drivers[0];
            let payments;

            if (batchIdFromComment) {
              [payments] = await connection.query(
                "SELECT id, batch_internal_id FROM payments WHERE driver_id = ? AND batch_id = ? AND status = 'processing' LIMIT 1",
                [driver.driver_id, batchIdFromComment]
              );
            } else {
              [payments] = await connection.query(
                "SELECT id, batch_internal_id FROM payments WHERE driver_id = ? AND status = 'processing' ORDER BY payment_date DESC LIMIT 1",
                [driver.driver_id]
              );
            }

            if (payments.length > 0) {
              const payment = payments[0];
              await connection.query(
                "UPDATE payments SET status = 'paid', payment_date = NOW() WHERE id = ?",
                [payment.id]
              );

              // IF there was a batch_internal_id, we might need to update the batch status
              if (payment.batch_internal_id) {
                // Check if all payments in this batch are now paid
                const [remaining] = await connection.query(
                  "SELECT COUNT(*) as count FROM payments WHERE batch_internal_id = ? AND status != 'paid'",
                  [payment.batch_internal_id]
                );
                if (remaining[0].count === 0) {
                  await connection.query(
                    "UPDATE payment_batches SET status = 'paid' WHERE id = ?",
                    [payment.batch_internal_id]
                  );
                }
              }

              await AuditService.log(
                req.user.id,
                "Reconcile Payment",
                "payment",
                payment.id,
                { driver_id: driver.driver_id, batch_id: batchIdFromComment }
              );
              results.success++;
            }
          }
        } catch (err) {
          console.error("Error processing row:", err);
          results.failed++;
        }
      }

      await connection.commit();

      // Fix #10: Improve success response
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
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Reconciliation processing error:", error);
      res.status(500).json({ message: "Processing failed: " + error.message });
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
  },

  getBatches: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      const [batches] = await pool.query(
        `SELECT b.*, u.full_name as exported_by_name,
                (SELECT COUNT(*) FROM payments WHERE batch_internal_id = b.id AND status = 'paid') as paid_count,
                b.driver_count as total_count
         FROM payment_batches b 
         LEFT JOIN users u ON b.exported_by = u.id 
         ORDER BY b.exported_at DESC 
         LIMIT ? OFFSET ?`,
        [limitNum, offset]
      );

      const [countRows] = await pool.query(
        "SELECT COUNT(*) as total FROM payment_batches"
      );

      res.json({
        batches,
        pagination: {
          page: parseInt(page),
          total: countRows[0].total,
          total_pages: Math.ceil(countRows[0].total / limitNum),
        },
      });
    } catch (error) {
      console.error("Get batches error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  downloadBatchExcel: async (req, res) => {
    try {
      const { batchId } = req.params;

      // Get batch metadata
      const [batchRows] = await pool.query(
        "SELECT * FROM payment_batches WHERE batch_id = ?",
        [batchId]
      );

      if (batchRows.length === 0) {
        return res.status(404).json({ message: "Batch not found" });
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
        [batch.id]
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
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Download batch error:", error);
      res.status(500).json({ message: "Failed to generate Excel file" });
    }
  },
};

module.exports = paymentController;
