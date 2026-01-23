const ExcelJS = require("exceljs");

const excelParser = {
  async validate(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheetCount = workbook.worksheets.length;
    const readable = true;
    const singleSheet = sheetCount === 1;

    let columnsValid = false;
    let requiredPresent = false;
    let columnsFound = [];
    let rowCount = 0;
    let hasData = false;
    let numericValid = true;
    let missingColumns = [];
    let suggestions = [];
    let detectedDate = null;

    if (singleSheet) {
      const worksheet = workbook.worksheets[0];
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        if (cell.value) {
          columnsFound.push(cell.value.toString());
        }
      });

      const normalizedHeaders = columnsFound.map((c) => c.toLowerCase().trim());
      const required = [
        "id",
        "full name",
        "phone number",
        "date",
        "net payout",
        "work terms",
        "status",
        "balance",
        "payout",
        "bank fee",
      ];

      missingColumns = required.filter(
        (col) => !normalizedHeaders.includes(col)
      );

      // Fuzzy match suggestions for missing columns
      if (missingColumns.length > 0) {
        missingColumns.forEach((missing) => {
          normalizedHeaders.forEach((found) => {
            if (getLevenshteinDistance(missing, found) <= 2) {
              suggestions.push(
                `Column '${found}' looks like '${missing}'. Did you mean '${missing}'?`
              );
            }
          });
        });
      }

      requiredPresent = missingColumns.length === 0;
      columnsValid = requiredPresent;

      rowCount = worksheet.rowCount - 1;
      hasData = rowCount > 0;

      if (requiredPresent) {
        const netPayoutIdx = normalizedHeaders.indexOf("net payout") + 1;
        const balanceIdx = normalizedHeaders.indexOf("balance") + 1;
        const payoutIdx = normalizedHeaders.indexOf("payout") + 1;
        const bankFeeIdx = normalizedHeaders.indexOf("bank fee") + 1;
        const dateIdx = normalizedHeaders.indexOf("date") + 1;

        let firstDateStr = null;

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;

          // Validate Numeric Fields (Net Payout, Balance, Payout, Bank Fee)
          const numericCols = [
            { idx: netPayoutIdx, name: "Net Payout" },
            { idx: balanceIdx, name: "Balance" },
            { idx: payoutIdx, name: "Payout" },
            { idx: bankFeeIdx, name: "Bank fee" },
          ];

          numericCols.forEach(({ idx, name }) => {
            const val = row.getCell(idx).value;
            const numericVal =
              val && typeof val === "object" && val.result !== undefined
                ? val.result
                : val;

            if (
              val !== null &&
              val !== undefined &&
              isNaN(parseFloat(numericVal))
            ) {
              numericValid = false;
              if (
                suggestions.filter((s) =>
                  s.includes(`Invalid numeric value in '${name}'`)
                ).length < 3
              ) {
                suggestions.push(
                  `Invalid numeric value in '${name}' at Row ${rowNumber}: '${val}'`
                );
              }
            }
          });

          // Detect Date & Check Consistency
          if (dateIdx > 0) {
            const dateVal = row.getCell(dateIdx).value;
            if (dateVal) {
              let rowDateStr = null;
              try {
                // Attempt to standardize date to YYYY-MM-DD for comparison
                // ExcelJS might give a Date object or a string
                const d = new Date(dateVal);
                if (!isNaN(d)) {
                  rowDateStr = d.toISOString().split("T")[0];
                }
              } catch (e) {
                // ignore invalid dates here, handled by null check below or parser
              }

              if (rowDateStr) {
                if (!detectedDate) {
                  detectedDate = rowDateStr; // First valid date found becomes the reference
                  firstDateStr = rowDateStr;
                } else if (rowDateStr !== detectedDate) {
                  suggestions.push(
                    `Mixed dates detected. Row ${rowNumber} has ${rowDateStr}, but expected ${detectedDate}.`
                  );
                }
              }
            }
          }
        });

        if (suggestions.some((s) => s.includes("Mixed dates"))) {
          // If mixed dates, nullify detectedDate to fail strict checks or handle via checklist
          // But better to keep detectedDate for display and rely on the suggestion error.
        }
      }
    }

    const mixedDates = suggestions.some((s) => s.includes("Mixed dates"));

    const checklist = [
      {
        item: "File is readable",
        status: readable ? "passed" : "failed",
        icon: readable ? "✅" : "❌",
      },
      {
        item: "Single sheet only",
        status: singleSheet ? "passed" : "failed",
        icon: singleSheet ? "✅" : "❌",
      },
      {
        item: "All required columns present",
        status: requiredPresent ? "passed" : "failed",
        icon: requiredPresent ? "✅" : "❌",
        details:
          suggestions.filter((s) => !s.includes("Mixed dates")).length > 0
            ? suggestions
            : null,
      },
      {
        item: "Column names are correct",
        status: columnsValid ? "passed" : "failed",
        icon: columnsValid ? "✅" : "❌",
      },
      {
        item: "File contains data",
        status: hasData ? "passed" : "failed",
        icon: hasData ? "✅" : "❌",
      },
      {
        item: "Dates are consistent",
        status: !mixedDates && detectedDate ? "passed" : "failed",
        icon: !mixedDates && detectedDate ? "✅" : "❌",
        details: mixedDates ? ["All rows must have the same date."] : null,
      },
      {
        item: "Net payout values are numeric",
        status: requiredPresent
          ? numericValid
            ? "passed"
            : "failed"
          : "not_checked",
        icon: requiredPresent ? (numericValid ? "✅" : "❌") : "⏭️",
      },
    ];

    return {
      validation_results: {
        file_readable: readable,
        single_sheet: singleSheet,
        sheet_count: sheetCount,
        columns_valid: columnsValid,
        required_columns_present: requiredPresent,
        columns_found: columnsFound,
        row_count: rowCount,
        has_data: hasData,
        numeric_validation: numericValid,
        missing_columns: missingColumns,
        suggestions: suggestions,
        detected_date: detectedDate,
        date_consistent: !mixedDates,
      },
      checklist,
      ready_for_import:
        readable &&
        singleSheet &&
        requiredPresent &&
        hasData &&
        numericValid &&
        detectedDate &&
        !mixedDates,
    };
  },

  async parse(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    if (workbook.worksheets.length !== 1) {
      throw new Error(
        `Excel file contains ${workbook.worksheets.length} sheets. Please import a file with only one sheet.`
      );
    }

    const worksheet = workbook.worksheets[0];
    const colMap = {};

    // Map column names to 1-based indices
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      if (cell.value) {
        const headerName = cell.value.toString().toLowerCase().trim();
        colMap[headerName] = colNumber;
      }
    });

    // Helper to get index
    const getIdx = (name) => colMap[name] || -1;

    const idIdx = getIdx("id");
    const nameIdx = getIdx("full name");
    const phoneIdx = getIdx("phone number");
    const dateIdx = getIdx("date");
    const payoutIdx = getIdx("net payout"); // This is Net Payout

    // New Columns
    const workTermsIdx = getIdx("work terms");
    const statusIdx = getIdx("status");
    const balanceIdx = getIdx("balance");
    const actualPayoutIdx = getIdx("payout"); // Named 'payout' in excel, distinct from net payout conceptually if different? User listed both.
    const bankFeeIdx = getIdx("bank fee");

    // If required columns are missing (should be caught by validate, but safe-guard)
    // If required columns are missing (should be caught by validate, but safe-guard)
    if (
      idIdx === -1 ||
      nameIdx === -1 ||
      dateIdx === -1 ||
      payoutIdx === -1 ||
      workTermsIdx === -1 ||
      statusIdx === -1 ||
      balanceIdx === -1 ||
      actualPayoutIdx === -1 ||
      bankFeeIdx === -1
    ) {
      throw new Error(
        "Validation mismatch: Required columns missing in parse step. Please re-validate."
      );
    }

    const data = [];
    let referenceDate = null;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      // Safe access
      const getVal = (idx) => (idx > 0 ? row.getCell(idx).value : null);

      // GHOST ROW CHECK
      const rawId = getVal(idIdx);
      const rawPayout = getVal(payoutIdx);

      if (
        (!rawId || rawId.toString().trim() === "") &&
        (!rawPayout ||
          (typeof rawPayout !== "object" && rawPayout.toString().trim() === ""))
      ) {
        return; // Skip empty row
      }

      const phoneVal = getVal(phoneIdx);
      const dateVal = getVal(dateIdx);

      let rowDateStr = null;
      if (dateVal) {
        try {
          const d = new Date(dateVal);
          if (!isNaN(d)) {
            rowDateStr = d.toISOString().split("T")[0];
          }
        } catch (e) {
          /* ignore */
        }
      }

      // Establish reference date from first valid row found
      if (rowDateStr && !referenceDate) {
        referenceDate = rowDateStr;
      }

      const rowData = {
        rowNumber,
        driver_id: rawId ? rawId.toString().trim() : null,
        full_name: getVal(nameIdx) ? getVal(nameIdx).toString().trim() : null,
        phone_number: phoneVal ? phoneVal.toString().trim() : null,
        week_date: dateVal,
        net_payout: null,
        work_terms: getVal(workTermsIdx)
          ? getVal(workTermsIdx).toString()
          : null,
        status: getVal(statusIdx) ? getVal(statusIdx).toString() : null,
        balance: null,
        payout: null,
        bank_fee: null,
        gross_payout: null,
        withholding_tax: null,
        errors: [],
      };

      // Helper to parse numeric
      const parseNum = (val) => {
        const v =
          val && typeof val === "object" && val.result !== undefined
            ? val.result
            : val;
        return v === null || v === undefined || isNaN(parseFloat(v))
          ? null
          : parseFloat(v);
      };

      // Parse the Excel "Net Payout" column - this is the fleet's original value
      rowData.fleet_net_payout = parseNum(getVal(payoutIdx)); // Store original
      rowData.net_payout = parseNum(getVal(payoutIdx)); // Keep for backward compatibility
      rowData.balance = parseNum(getVal(balanceIdx));
      rowData.payout = parseNum(getVal(actualPayoutIdx));
      rowData.bank_fee = parseNum(getVal(bankFeeIdx));

      if (!rowData.driver_id) rowData.errors.push("Missing ID");
      if (!rowData.full_name) rowData.errors.push("Missing Full Name");
      if (!rowData.phone_number) rowData.errors.push("Missing Phone Number");

      if (rowData.net_payout === null)
        rowData.errors.push(`Invalid Net payout`);
      if (rowData.balance === null) rowData.errors.push(`Invalid Balance`);
      if (rowData.payout === null) rowData.errors.push(`Invalid Payout`);
      if (rowData.bank_fee === null) rowData.errors.push(`Invalid Bank fee`);

      // Calculations
      if (rowData.fleet_net_payout !== null) {
        // Only gross up if the net payout is greater than 10,000 ETB
        if (rowData.fleet_net_payout > 10000) {
          // Step 1: Reverse to gross (assuming 3% withholding was applied)
          rowData.gross_payout = rowData.fleet_net_payout / 0.97;
          // Step 2: Calculate withholding tax from gross (3%)
          rowData.withholding_tax = rowData.gross_payout * 0.03;
        } else {
          // No gross-up for amounts <= 10,000
          rowData.gross_payout = rowData.fleet_net_payout;
          rowData.withholding_tax = 0;
        }

        // Step 3: Calculate proper net (gross - withholding)
        rowData.calculated_net = rowData.gross_payout - rowData.withholding_tax;

        // Round to 2 decimals
        rowData.gross_payout = Math.round(rowData.gross_payout * 100) / 100;
        rowData.withholding_tax =
          Math.round(rowData.withholding_tax * 100) / 100;
        rowData.calculated_net = Math.round(rowData.calculated_net * 100) / 100;
      }

      if (referenceDate && rowDateStr && rowDateStr !== referenceDate) {
        rowData.errors.push(
          `Date mismatch: Found ${rowDateStr}, expected ${referenceDate}`
        );
      }

      data.push(rowData);
    });

    return data;
  },
};

/**
 * Calculates Levenshtein distance between two strings
 */
function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

module.exports = excelParser;
