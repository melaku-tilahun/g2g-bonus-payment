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

      requiredPresent = missingColumns.length === 0;
      columnsValid = requiredPresent;

      rowCount = worksheet.rowCount - 1;
      hasData = rowCount > 0;

      if (requiredPresent) {
        const netPayoutIdx = normalizedHeaders.indexOf('net payout') + 1;
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const val = row.getCell(netPayoutIdx).value;
          // Handle cases where val might be an object (like { formula: '...', result: 123 })
          const numericVal = (val && typeof val === 'object' && val.result !== undefined) ? val.result : val;
          if (val !== null && val !== undefined && isNaN(parseFloat(numericVal))) {
            numericValid = false;
          }
        });
      }
    }

    const checklist = [
      { item: "File is readable", status: readable ? "passed" : "failed", icon: readable ? "✅" : "❌" },
      { item: "Single sheet only", status: singleSheet ? "passed" : "failed", icon: singleSheet ? "✅" : "❌" },
      { item: "All required columns present", status: requiredPresent ? "passed" : "failed", icon: requiredPresent ? "✅" : "❌" },
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
        missing_columns: missingColumns
      },
      checklist,
      ready_for_import: readable && singleSheet && requiredPresent && hasData && numericValid
    };
  },

  async parse(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    if (workbook.worksheets.length !== 1) {
      throw new Error(`Excel file contains ${workbook.worksheets.length} sheets. Please upload a file with only one sheet.`);
    }

    const worksheet = workbook.worksheets[0];
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
      if (cell.value) {
        headers.push(cell.value.toString().toLowerCase().trim());
      } else {
        headers.push('');
      }
    });

    const idIdx = headers.indexOf('id') + 1;
    const nameIdx = headers.indexOf('full name') + 1;
    const phoneIdx = headers.indexOf('phone number') + 1;
    const dateIdx = headers.indexOf('date') + 1;
    const payoutIdx = headers.indexOf('net payout') + 1;

    const data = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rowData = {
        rowNumber,
        driver_id: row.getCell(idIdx).value ? row.getCell(idIdx).value.toString().trim() : null,
        full_name: row.getCell(nameIdx).value ? row.getCell(nameIdx).value.toString().trim() : null,
        phone_number: row.getCell(phoneIdx).value ? row.getCell(phoneIdx).value.toString().trim() : null,
        week_date: row.getCell(dateIdx).value,
        net_payout: null,
        errors: []
      };

      // Handle payout which might be a formula or a number
      const payoutVal = row.getCell(payoutIdx).value;
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

module.exports = excelParser;
