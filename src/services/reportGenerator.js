const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

/**
 * Report Generator Service
 * Handles PDF and Excel report generation
 */
class ReportGenerator {
  /**
   * Generate Withholding Tax Excel Report
   * @param {array} taxData - Tax report data
   */
  static async generateWithholdingTaxExcel(taxData) {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Withholding Tax Report");

      // Set up columns
      sheet.columns = [
        { header: "Driver ID", key: "driver_id", width: 35 },
        { header: "Driver Name", key: "full_name", width: 30 },
        { header: "TIN Number", key: "tin", width: 20 },
        { header: "Business Name", key: "business_name", width: 30 },
        { header: "Gross Amount (ETB)", key: "total_gross", width: 18 },
        { header: "Tax Withheld (ETB)", key: "total_tax", width: 18 },
        { header: "Net Amount (ETB)", key: "total_net", width: 18 },
        { header: "Payment Count", key: "payment_count", width: 15 },
        { header: "First Payment", key: "first_payment_date", width: 15 },
        { header: "Last Payment", key: "last_payment_date", width: 15 },
      ];

      // Style header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      sheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true };

      // Add data rows
      taxData.forEach((row) => {
        sheet.addRow({
          driver_id: row.driver_id,
          full_name: row.full_name,
          tin: row.tin || "N/A",
          business_name: row.business_name || "N/A",
          total_gross: parseFloat(row.total_gross).toFixed(2),
          total_tax: parseFloat(row.total_tax).toFixed(2),
          total_net: parseFloat(row.total_net).toFixed(2),
          payment_count: row.payment_count,
          first_payment_date: row.first_payment_date,
          last_payment_date: row.last_payment_date,
        });
      });

      // Add totals row
      const lastRow = sheet.rowCount + 1;
      sheet.getRow(lastRow).font = { bold: true };
      sheet.getRow(lastRow).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7E6E6" },
      };

      const totalGross = taxData.reduce(
        (sum, row) => sum + parseFloat(row.total_gross),
        0
      );
      const totalTax = taxData.reduce(
        (sum, row) => sum + parseFloat(row.total_tax),
        0
      );
      const totalNet = taxData.reduce(
        (sum, row) => sum + parseFloat(row.total_net),
        0
      );

      sheet.getRow(lastRow).values = [
        "",
        "",
        "",
        "TOTALS:",
        totalGross.toFixed(2),
        totalTax.toFixed(2),
        totalNet.toFixed(2),
        "",
        "",
        "",
      ];

      // Save file
      const filename = path.join(
        __dirname,
        "../../uploads",
        `withholding_tax_${Date.now()}.xlsx`
      );
      await workbook.xlsx.writeFile(filename);
      return filename;
    } catch (error) {
      console.error("Generate withholding tax excel error:", error);
      throw error;
    }
  }

  /**
   * Generate Driver Statement PDF
   * @param {object} driver - Driver information
   * @param {array} bonuses - Bonus records
   * @param {object} debtSummary - Debt summary
   */
  static async generateDriverStatementPDF(driver, bonuses, debtSummary) {
    return new Promise((resolve, reject) => {
      try {
        const filename = path.join(
          __dirname,
          "../../uploads",
          `statement_${driver.driver_id}_${Date.now()}.pdf`
        );
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filename);

        doc.pipe(stream);

        // Header
        doc.fontSize(20).text("Driver Payment Statement", { align: "center" });
        doc.moveDown(2);

        // Driver Info
        doc.fontSize(12).font("Helvetica-Bold");
        doc.text("Driver Information", { underline: true });
        doc.moveDown(0.5);

        doc.font("Helvetica");
        doc.text(`Driver ID: ${driver.driver_id}`);
        doc.text(`Name: ${driver.full_name}`);
        if (driver.phone_number) doc.text(`Phone: ${driver.phone_number}`);
        if (driver.tin) doc.text(`TIN: ${driver.tin}`);
        if (driver.business_name) doc.text(`Business: ${driver.business_name}`);
        doc.text(`Status: ${driver.verified ? "Verified" : "Unverified"}`);
        doc.moveDown(1.5);

        // Bonus Summary
        doc.font("Helvetica-Bold");
        doc.text("Bonus Summary", { underline: true });
        doc.moveDown(0.5);

        const totalGross = bonuses.reduce(
          (sum, b) => sum + parseFloat(b.gross_payout || 0),
          0
        );
        const totalTax = bonuses.reduce(
          (sum, b) => sum + parseFloat(b.withholding_tax || 0),
          0
        );
        const totalNet = bonuses.reduce(
          (sum, b) => sum + parseFloat(b.net_payout || 0),
          0
        );
        const totalFinal = bonuses.reduce(
          (sum, b) => sum + parseFloat(b.final_payout || b.net_payout || 0),
          0
        );

        doc.font("Helvetica");
        doc.text(`Total Bonuses: ${bonuses.length}`);
        doc.text(`Total Gross Amount: ${totalGross.toLocaleString()} ETB`);
        doc.text(`Total Tax Withheld: ${totalTax.toLocaleString()} ETB`);
        doc.text(`Total Net Amount: ${totalNet.toLocaleString()} ETB`);
        doc.text(`Total Final Payout: ${totalFinal.toLocaleString()} ETB`);
        doc.moveDown(1.5);

        // Debt Summary (if applicable)
        if (debtSummary && parseFloat(debtSummary.outstanding) > 0) {
          doc.font("Helvetica-Bold");
          doc.text("Debt Summary", { underline: true });
          doc.moveDown(0.5);

          doc.font("Helvetica");
          doc.text(
            `Total Debt: ${parseFloat(
              debtSummary.total_debt
            ).toLocaleString()} ETB`
          );
          doc.text(
            `Amount Paid: ${parseFloat(
              debtSummary.total_paid
            ).toLocaleString()} ETB`
          );
          doc.text(
            `Outstanding: ${parseFloat(
              debtSummary.outstanding
            ).toLocaleString()} ETB`
          );
          doc.moveDown(1.5);
        }

        // Bonus Details Table
        doc.addPage();
        doc.fontSize(14).font("Helvetica-Bold");
        doc.text("Bonus Details", { underline: true });
        doc.moveDown(1);

        // Table header
        doc.fontSize(9).font("Helvetica-Bold");
        const tableTop = doc.y;
        const colWidths = {
          week: 80,
          gross: 80,
          tax: 70,
          net: 70,
          final: 70,
          status: 80,
        };
        let x = 50;

        doc.text("Week Date", x, tableTop);
        x += colWidths.week;
        doc.text("Gross", x, tableTop);
        x += colWidths.gross;
        doc.text("Tax", x, tableTop);
        x += colWidths.tax;
        doc.text("Net", x, tableTop);
        x += colWidths.net;
        doc.text("Final", x, tableTop);
        x += colWidths.final;
        doc.text("Status", x, tableTop);

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.3);

        // Table rows
        doc.font("Helvetica").fontSize(8);
        bonuses.forEach((bonus) => {
          x = 50;
          const y = doc.y;

          doc.text(bonus.week_date.toString().substring(0, 10), x, y, {
            width: colWidths.week,
          });
          x += colWidths.week;
          doc.text(parseFloat(bonus.gross_payout).toFixed(2), x, y, {
            width: colWidths.gross,
          });
          x += colWidths.gross;
          doc.text(parseFloat(bonus.withholding_tax).toFixed(2), x, y, {
            width: colWidths.tax,
          });
          x += colWidths.tax;
          doc.text(parseFloat(bonus.net_payout).toFixed(2), x, y, {
            width: colWidths.net,
          });
          x += colWidths.net;
          doc.text(
            parseFloat(bonus.final_payout || bonus.net_payout).toFixed(2),
            x,
            y,
            { width: colWidths.final }
          );
          x += colWidths.final;
          doc.text(bonus.payment_status || "Pending", x, y, {
            width: colWidths.status,
          });

          doc.moveDown(0.8);

          // Add page if needed
          if (doc.y > 700) {
            doc.addPage();
            doc.moveDown(2);
          }
        });

        // Footer
        doc.fontSize(8).font("Helvetica");
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, 750, {
          align: "center",
        });

        doc.end();

        stream.on("finish", () => resolve(filename));
        stream.on("error", reject);
      } catch (error) {
        reject(error);
      }
    });
  }
  /**
   * Generate TIN Verification Excel Report
   * @param {array} logData - TIN verification log data
   */
  static async generateTINVerificationExcel(logData) {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("TIN Verification Log");

      // Set up columns
      sheet.columns = [
        { header: "Date", key: "created_at", width: 20 },
        { header: "Driver ID", key: "driver_id", width: 35 },
        { header: "Driver Name", key: "full_name", width: 30 },
        { header: "TIN", key: "tin", width: 20 },
        { header: "Action", key: "action", width: 30 },
        { header: "Performed By", key: "verified_by_name", width: 25 },
        { header: "Status", key: "status", width: 15 },
      ];

      // Style header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      sheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true };

      // Add data rows
      logData.forEach((log) => {
        sheet.addRow({
          created_at: new Date(log.created_at).toLocaleString(),
          driver_id: log.driver_id || "N/A",
          full_name: log.full_name || "N/A",
          tin: log.tin || "N/A",
          action: log.action,
          verified_by_name: log.verified_by_name || "System",
          status: log.verified ? "Verified" : "Unverified",
        });
      });

      // Save file
      const filename = path.join(
        __dirname,
        "../../uploads",
        `tin_verification_${Date.now()}.xlsx`
      );
      await workbook.xlsx.writeFile(filename);
      return filename;
    } catch (error) {
      console.error("Generate TIN verification excel error:", error);
      throw error;
    }
  }
}

module.exports = ReportGenerator;
