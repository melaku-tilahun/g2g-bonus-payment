const ExcelJS = require('exceljs');

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

      const normalizedHeaders = columnsFound.map(c => c.toLowerCase().trim());
      const required = ['id', 'full name', 'date', 'net payout'];
      
      missingColumns = required.filter(col => !normalizedHeaders.includes(col));

      // Fuzzy match suggestions for missing columns
      if (missingColumns.length > 0) {
        missingColumns.forEach(missing => {
          normalizedHeaders.forEach(found => {
             if (getLevenshteinDistance(missing, found) <= 2) {
                 suggestions.push(`Column '${found}' looks like '${missing}'. Did you mean '${missing}'?`);
             }
          });
        });
      }

      requiredPresent = missingColumns.length === 0;
      columnsValid = requiredPresent;

      rowCount = worksheet.rowCount - 1;
      hasData = rowCount > 0;

      if (requiredPresent) {
        const netPayoutIdx = normalizedHeaders.indexOf('net payout') + 1;
        const dateIdx = normalizedHeaders.indexOf('date') + 1;

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          
          // Validate Numeric Payout
          const val = row.getCell(netPayoutIdx).value;
          const numericVal = (val && typeof val === 'object' && val.result !== undefined) ? val.result : val;
          if (val !== null && val !== undefined && isNaN(parseFloat(numericVal))) {
            numericValid = false;
          }

          // Detect Date (from first row only)
          if (rowNumber === 2 && dateIdx > 0) {
              const dateVal = row.getCell(dateIdx).value;
              if (dateVal) {
                  // Normalize date if needed, but for display sending raw or ISO string is fine
                  try {
                    detectedDate = new Date(dateVal).toISOString().split('T')[0];
                  } catch (e) {
                    detectedDate = "Invalid Date Format";
                  }
              }
          }
        });
      }
    }

    const checklist = [
      { item: "File is readable", status: readable ? "passed" : "failed", icon: readable ? "✅" : "❌" },
      { item: "Single sheet only", status: singleSheet ? "passed" : "failed", icon: singleSheet ? "✅" : "❌" },
      { item: "All required columns present", status: requiredPresent ? "passed" : "failed", icon: requiredPresent ? "✅" : "❌", details: suggestions.length > 0 ? suggestions : null },
      { item: "Column names are correct", status: columnsValid ? "passed" : "failed", icon: columnsValid ? "✅" : "❌" },
      { item: "File contains data", status: hasData ? "passed" : "failed", icon: hasData ? "✅" : "❌" },
      { item: "Net payout values are numeric", status: requiredPresent ? (numericValid ? "passed" : "failed") : "not_checked", icon: requiredPresent ? (numericValid ? "✅" : "❌") : "⏭️" }
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
        detected_date: detectedDate
      },
      checklist,
      ready_for_import: readable && singleSheet && requiredPresent && hasData && numericValid && detectedDate
    };
  },

  async parse(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    if (workbook.worksheets.length !== 1) {
      throw new Error(`Excel file contains ${workbook.worksheets.length} sheets. Please upload a file with only one sheet.`);
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

    const idIdx = getIdx('id');
    const nameIdx = getIdx('full name');
    const phoneIdx = getIdx('phone number');
    const dateIdx = getIdx('date');
    const payoutIdx = getIdx('net payout');

    // If required columns are missing (should be caught by validate, but safe-guard)
    if (idIdx === -1 || nameIdx === -1 || dateIdx === -1 || payoutIdx === -1) {
       throw new Error("Validation mismatch: Required columns missing in parse step. Please re-validate.");
    }

    const data = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      // Safe access
      const getVal = (idx) => idx > 0 ? row.getCell(idx).value : null;

      const phoneVal = getVal(phoneIdx);

      const rowData = {
        rowNumber,
        driver_id: getVal(idIdx) ? getVal(idIdx).toString().trim() : null,
        full_name: getVal(nameIdx) ? getVal(nameIdx).toString().trim() : null,
        phone_number: phoneVal ? phoneVal.toString().trim() : null,
        week_date: getVal(dateIdx),
        net_payout: null,
        errors: []
      };

      // Handle payout which might be a formula or a number
      const payoutVal = getVal(payoutIdx);
      rowData.net_payout = (payoutVal && typeof payoutVal === 'object' && payoutVal.result !== undefined) ? payoutVal.result : payoutVal;

      if (!rowData.driver_id) rowData.errors.push('Missing ID');
      if (!rowData.full_name) rowData.errors.push('Missing Full Name');
      if (rowData.net_payout === null || rowData.net_payout === undefined || isNaN(parseFloat(rowData.net_payout))) {
        rowData.errors.push(`Invalid Net payout: ${rowData.net_payout}`);
      } else {
        rowData.net_payout = parseFloat(rowData.net_payout);
      }

      data.push(rowData);
    });

    return data;
  }
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
