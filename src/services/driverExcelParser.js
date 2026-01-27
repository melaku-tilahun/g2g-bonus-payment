const ExcelJS = require("exceljs");

const driverExcelParser = {
  async parse(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    if (workbook.worksheets.length === 0) {
      throw new Error("Excel file is empty.");
    }

    const worksheet = workbook.worksheets[0];
    const data = [];
    const colMap = {};

    // Map column names to 1-based indices
    const headerRow = worksheet.getRow(1);
    for (let i = 1; i <= headerRow.cellCount; i++) {
        const cell = headerRow.getCell(i);
        if (cell.value) {
            const headerName = cell.value.toString().toLowerCase().trim();
            colMap[headerName] = i;
        }
    }

    // Helper to get index
    const getIdx = (names) => {
        for (const name of names) {
            if (colMap[name]) return colMap[name];
        }
        return -1;
    };

    const idIdx = getIdx(["id", "driver id", "driver_id"]);
    const nameIdx = getIdx(["name", "full name", "full_name"]);
    const phoneIdx = getIdx(["phone", "phone number", "phone_number"]);
    const dlIdx = getIdx(["dl number", "licence_number", "dl"]);
    const tinIdx = getIdx(["tin"]);
    const validBeforeIdx = getIdx(["valid before"]);
    const revalidationIdx = getIdx(["re-validation"]);

    if (idIdx === -1 || nameIdx === -1 || phoneIdx === -1) {
      throw new Error("Required columns missing: ID, Name, and Phone are mandatory.");
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const getVal = (idx) => (idx > 0 ? row.getCell(idx).value : null);
      
      const rawId = getVal(idIdx);
      if (!rawId || rawId.toString().trim() === "") return;

      const tin = getVal(tinIdx) ? getVal(tinIdx).toString().trim() : null;
      const dl = getVal(dlIdx) ? getVal(dlIdx).toString().trim() : null;
      
      const validBefore = getVal(validBeforeIdx);
      const revalidation = getVal(revalidationIdx);
      
      const notes = {};
      if (validBefore) notes.old_system_valid_before = validBefore;
      if (revalidation) notes.old_system_revalidation_by = revalidation;

      data.push({
        driver_id: rawId.toString().trim(),
        full_name: getVal(nameIdx) ? getVal(nameIdx).toString().trim() : null,
        phone_number: getVal(phoneIdx) ? getVal(phoneIdx).toString().trim() : null,
        tin: tin && tin.length > 0 ? tin : null,
        licence_number: dl && dl.length > 0 ? dl : null,
        notes: Object.keys(notes).length > 0 ? notes : null
      });
    });

    return data;
  }
};

module.exports = driverExcelParser;
