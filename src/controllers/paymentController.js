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
      const { driver_id } = req.query;
      let query = `
        SELECT p.*, d.full_name as driver_name, u.full_name as processed_by_name 
        FROM payments p
        JOIN drivers d ON p.driver_id = d.driver_id
        JOIN users u ON p.processed_by = u.id
      `;
      const params = [];

      if (driver_id) {
        query += " WHERE p.driver_id = ?";
        params.push(driver_id);
      }

      query += " ORDER BY p.payment_date DESC";

      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Get payment history error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getPendingPayments: async (req, res) => {
    try {
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
        WHERE d.verified = TRUE AND b.payment_id IS NULL
        GROUP BY d.driver_id, d.full_name, d.phone_number
        ORDER BY total_pending_amount DESC
      `;
      const [rows] = await pool.query(query);
      res.json(rows);
    } catch (error) {
      console.error("Get pending payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getAccumulatedPayments: async (req, res) => {
    try {
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
        WHERE d.verified = FALSE AND b.payment_id IS NULL
        GROUP BY d.driver_id, d.full_name, d.phone_number
        ORDER BY total_pending_amount DESC
      `;
      const [rows] = await pool.query(query);
      res.json(rows);
    } catch (error) {
      console.error("Get accumulated payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  exportPendingPayments: async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const crypto = require("crypto");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Pending Payments");

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
        WHERE d.verified = TRUE AND b.payment_id IS NULL
        GROUP BY d.driver_id, d.full_name, d.phone_number
        ORDER BY total_pending_amount DESC
      `;
      const [rows] = await pool.query(query);

      const batchId = `BATCH${new Date()
        .toISOString()
        .split("T")[0]
        .replace(/-/g, "")}`;

      const tableData = rows.map((row) => {
        let phone = row.phone_number || "";
        phone = phone.replace(/\s+/g, "").replace(/\-/g, "");
        if (phone.startsWith("+251")) phone = phone.substring(4);
        else if (phone.startsWith("251")) phone = phone.substring(3);
        else if (phone.startsWith("0")) phone = phone.substring(1);

        return [
          "MSISDN",
          phone,
          "",
          parseFloat(row.total_pending_amount),
          `${row.driver_id},${batchId}`,
        ];
      });

      // Add Table with style and filters
      worksheet.addTable({
        name: "PendingPaymentsTable",
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium2", // Matches the blue theme in the image
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

      // Adjust column formatting and widths
      worksheet.getColumn(1).width = 15;
      worksheet.getColumn(2).width = 18;
      worksheet.getColumn(3).width = 25;
      worksheet.getColumn(4).width = 15;
      worksheet.getColumn(5).width = 50;

      // Set number format for Amount column
      worksheet.getColumn(4).numFmt = "#,##0.00";

      // Alignment
      worksheet.getColumn(1).alignment = { horizontal: "center" };
      worksheet.getColumn(2).alignment = { horizontal: "left" }; // Phone numbers better left-aligned
      worksheet.getColumn(4).alignment = { horizontal: "right" };

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
      console.error("Export pending payments error:", error);
      res.status(500).json({ message: "Internal server error" });
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
};

module.exports = paymentController;
