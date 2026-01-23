const pool = require("../../config/database");
const AuditService = require("../../services/auditService");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");

const reconciliationController = {
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
    const importDir = path.join(__dirname, "../../../public/reconciliationfile"); // Absolute path
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

    const importDir = path.join(__dirname, "../../../public/reconciliationfile");
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
};

module.exports = reconciliationController;
