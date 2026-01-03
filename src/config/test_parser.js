const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const excelParser = require("../services/excelParser");

async function testParser() {
  const filePath = path.join(__dirname, "test_import.xlsx");

  // 1. Create Test File
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  sheet.addRow([
    "ID",
    "Full Name",
    "Date",
    "Net Payout",
    "Work terms",
    "Status",
    "Balance",
    "Payout",
    "Bank fee",
  ]);

  // Row 1: Low Payout (No Withholding)
  sheet.addRow([
    "DRV001",
    "John Doe",
    "2023-01-01",
    1000,
    "Standard",
    "Active",
    100,
    900,
    10,
  ]);

  // Row 2: High Payout (With Withholding)
  sheet.addRow([
    "DRV002",
    "Jane Doe",
    "2023-01-01",
    5000,
    "Premium",
    "Pending",
    500,
    4500,
    50,
  ]);

  await workbook.xlsx.writeFile(filePath);
  console.log("Created test file:", filePath);

  try {
    // 2. Parse
    const parsedData = await excelParser.parse(filePath);
    console.log("Parsed Data Results:");

    parsedData.forEach((row) => {
      console.log(`Driver: ${row.driver_id}, Net: ${row.net_payout}`);
      console.log(
        `  Gross: ${row.gross_payout} (Expected: ${(
          row.net_payout / 0.97
        ).toFixed(2)})`
      );
      console.log(`  Withholding: ${row.withholding_tax}`);
      console.log(`  Work Terms: ${row.work_terms}`);
      console.log(`  Status: ${row.status}`);
      console.log("---");
    });
  } catch (error) {
    console.error("Test Failed:", error);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Cleanup
    }
  }
}

testParser();
