const pool = require("../config/database");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const statementController = {
  getStatement: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { type = "full" } = req.query; // 'debt', 'payment', 'bonus', 'full'

    // 1. Security Check (Role-Based Access)
    // Allow internal staff to view any statement.
    // Restrict drivers (if they ever login) to their own data.
    const allowedRoles = ["admin", "director", "manager", "auditor", "staff"];

    if (req.user && !allowedRoles.includes(req.user.role)) {
      // Fallback for strict ID checking (e.g. for a driver user)
      if (!req.user.driver_id || String(req.user.driver_id) !== String(id)) {
        throw new AppError("Unauthorized access to this statement", 403);
      }
    }

    // 2. Fetch Driver Data
    const [driverRows] = await pool.query(
      "SELECT * FROM drivers WHERE driver_id = ?",
      [id]
    );
    if (driverRows.length === 0) throw new AppError("Driver not found", 404);
    const driver = driverRows[0];

    // 3. Parallel Data Fetching
    const bonusPromise =
      type === "bonus" || type === "full"
        ? pool.query(
            "SELECT * FROM bonuses WHERE driver_id = ? ORDER BY week_date DESC",
            [id]
          )
        : Promise.resolve([[]]);

    const paymentPromise =
      type === "payment" || type === "full"
        ? pool.query(
            "SELECT * FROM payments WHERE driver_id = ? ORDER BY payment_date DESC",
            [id]
          )
        : Promise.resolve([[]]);

    const debtPromise =
      type === "debt" || type === "full"
        ? pool.query(
            "SELECT * FROM driver_debts WHERE driver_id = ? ORDER BY created_at DESC",
            [id]
          )
        : Promise.resolve([[]]);

    const [[bonuses], [payments], [debts]] = await Promise.all([
      bonusPromise,
      paymentPromise,
      debtPromise,
    ]);

    console.log(`Streaming Styled PDF for driver ${id}, type: ${type}`);

    // 4. Setup Streaming Response
    const filename = `${type.toUpperCase()}_Statement_${driver.full_name.replace(
      /\s+/g,
      "_"
    )}_${Date.now()}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });

    const doc = new PDFDocument({
      margin: 50,
      bufferPages: true, // Enable to add watermark behind all content
    });
    doc.pipe(res);

    // --- ASSETS ---
    const logoPath = path.join(__dirname, "../../public/assets/g2g-logo.png");
    const hasLogo = fs.existsSync(logoPath);

    // --- HELPER FUNCTIONS ---
    // --- HELPER FUNCTIONS ---
    const addWatermarkToAllPages = () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.save();
        doc.fillColor("#E0E0E0"); // Professional Light Gray
        doc.fontSize(45);
        doc.opacity(0.5); // Increase opacity slightly since it's light gray

        // Single line watermark, centered and rotated
        doc.rotate(-45, {
          origin: [doc.page.width / 2, doc.page.height / 2],
        });
        doc.text("GTOG IT SOLUTIONS S.C.", 0, doc.page.height / 2, {
          align: "center",
          width: doc.page.width,
        });
        doc.rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] });

        doc.restore();
      }
    };

    const drawHeader = () => {
      // Logo
      if (hasLogo) {
        doc.image(logoPath, 50, 45, { width: 50 });
      }

      // Company Name
      doc.font("Times-Bold").fontSize(18).fillColor("#1a1a1a");
      doc.text("GTOG IT SOLUTIONS SHARE COMPANY", 110, 50);

      doc.font("Times-Roman").fontSize(10).fillColor("#4a4a4a");
      doc.text("Addis Ababa, Ethiopia", 110, 75);
      doc.text("Phone: +251 911 559 277", 110, 88);

      doc.moveDown(3);

      // Divider
      doc.moveTo(50, 110).lineTo(550, 110).strokeColor("#28a745").stroke();
      doc.moveDown(2);
    };

    const drawTable = (title, headers, rows, colWidths) => {
      let y = doc.y + 20;

      // Section Title
      doc
        .font("Times-Bold")
        .fontSize(14)
        .fillColor("#1a1a1a")
        .text(title, 50, doc.y);
      doc.moveDown(0.5);
      y = doc.y;

      // Table Header Background
      doc.rect(50, y, 500, 20).fill("#f8f9fa");

      // Table Header Text
      doc.fillColor("#2a2a2a").fontSize(9).font("Times-Bold");
      let x = 60;
      headers.forEach((h, i) => {
        doc.text(h, x, y + 5, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      y += 25;

      // Rows
      doc.font("Times-Roman").fontSize(9);
      rows.forEach((row, rowIndex) => {
        // Striping
        if (rowIndex % 2 === 0) {
          doc.rect(50, y - 5, 500, 20).fill("#ffffff");
        } else {
          doc.rect(50, y - 5, 500, 20).fill("#f9fafb");
        }

        doc.fillColor("#444444");
        x = 60;
        row.forEach((cell, i) => {
          doc.text(cell.toString(), x, y, {
            width: colWidths[i],
            align: "left",
          });
          x += colWidths[i];
        });
        y += 20;

        // Check page break
        if (y > 700) {
          doc.addPage();
          // Note: 'pageAdded' event could be used, but we manually control header here for tables
          drawHeader();
          // Watermark added at the end
          y = 120;
        }
      });
      doc.moveDown(2);
    };

    // --- DOCUMENT GENERATION ---

    // Initial Watermark & Header (Header drawn now, Watermark at the end)
    drawHeader();

    // Statement Title & Detailed Timestamp
    const now = new Date();
    const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, "0")}`;

    doc
      .font("Times-Bold")
      .fontSize(16)
      .fillColor("#000000")
      .text(`${type.toUpperCase()} STATEMENT`, 50, 130);
    doc
      .font("Times-Roman")
      .fontSize(9)
      .text(`Generated: ${timestamp}`, 400, 135, {
        align: "right",
      });

    // Driver Info Box
    doc.rect(50, 160, 500, 80).strokeColor("#d0d0d0").stroke();
    doc
      .font("Times-Bold")
      .fontSize(11)
      .fillColor("#2a2a2a")
      .text("DRIVER DETAILS", 65, 175);

    doc.font("Times-Roman").fontSize(10).fillColor("#5a5a5a");
    doc.text(`Name:`, 65, 195);
    doc.text(`Driver ID:`, 65, 210);
    doc.text(`Phone:`, 65, 225);

    doc.fillColor("#111827");
    doc.text(driver.full_name, 130, 195);
    doc.text(driver.driver_id, 130, 210);
    doc.text(driver.phone_number, 130, 225);

    doc.fillColor("#6b7280").text("Status:", 350, 195);
    const statusText = driver.verified ? "Verified" : "Unverified";
    doc
      .fillColor(driver.verified ? "#059669" : "#d97706")
      .text(statusText + (driver.is_blocked ? " (BLOCKED)" : ""), 400, 195);

    doc.y = 260; // Move below info box

    // --- CONTENT TABLES ---

    if (bonuses.length > 0) {
      const rows = bonuses.slice(0, type === "full" ? 10 : 500).map((b) => {
        const gross = parseFloat(b.calculated_gross_payout || b.calculated_net_payout / 0.97 || 0);
        const withholding = parseFloat(b.calculated_withholding_tax || 0);
        const net = parseFloat(b.calculated_net_payout || 0);
        const final = parseFloat(
          b.final_payout !== null ? b.final_payout : net
        );
        const deductions = net - final;

        return [
          new Date(b.week_date).toLocaleDateString(),
          `${gross.toLocaleString()} ETB`,
          `${withholding.toLocaleString()} ETB`,
          deductions > 0 ? `${deductions.toLocaleString()} ETB` : "-",
          `${final.toLocaleString()} ETB`,
          b.payment_id ? "Paid" : "Pending",
        ];
      });
      drawTable(
        "Bonus History",
        ["Week", "Gross", "Tax", "Deductions", "Final", "Status"],
        rows,
        [70, 80, 60, 80, 80, 60]
      );
    }

    if (payments.length > 0) {
      const rows = payments
        .slice(0, type === "full" ? 10 : 500)
        .map((p) => [
          new Date(p.payment_date).toLocaleDateString(),
          `${parseFloat(p.total_amount).toLocaleString()} ETB`,
          p.payment_method.replace("_", " "),
          p.status,
        ]);
      drawTable(
        "Payment History",
        ["Date", "Total Amount", "Method", "Status"],
        rows,
        [100, 120, 120, 100]
      );
    }

    // Separate penalties from regular debts
    const penalties = debts.filter(
      (d) => d.reason === "Additional Withholding Tax"
    );
    const regularDebts = debts.filter(
      (d) => d.reason !== "Additional Withholding Tax"
    );

    // Regular Debts
    if (regularDebts.length > 0) {
      const rows = regularDebts
        .slice(0, type === "full" ? 10 : 500)
        .map((d) => [
          new Date(d.created_at).toLocaleDateString(),
          d.reason,
          `${parseFloat(d.amount).toLocaleString()} ETB`,
          `${parseFloat(d.remaining_amount).toLocaleString()} ETB`,
          d.status,
        ]);
      drawTable(
        "Debts & Liabilities",
        ["Date", "Reason", "Amount", "Remaining", "Status"],
        rows,
        [80, 120, 90, 90, 70]
      );
    }

    // Verification Penalties (Separate Section)
    if (penalties.length > 0) {
      const rows = penalties
        .slice(0, type === "full" ? 10 : 500)
        .map((d) => [
          new Date(d.created_at).toLocaleDateString(),
          "⚠️ 30% deduction for unverified payout",
          `${parseFloat(d.amount).toLocaleString()} ETB`,
          d.status,
        ]);
      drawTable(
        "Verification Penalties",
        ["Date", "Description", "Amount", "Status"],
        rows,
        [100, 200, 100, 100]
      );
    }

    if (
      (!bonuses || bonuses.length === 0) &&
      (!payments || payments.length === 0) &&
      (!debts || debts.length === 0)
    ) {
      doc.moveDown(5);
      doc
        .fontSize(12)
        .fillColor("gray")
        .text("No records found for this period.", { align: "center" });
    }

    // Apply watermark to all pages before ending
    addWatermarkToAllPages();

    doc.end();
    console.log("PDF Stream ended.");
  }),
};

module.exports = statementController;
