// const pool = require("../src/config/database");
// const SchedulerService = require("../src/services/schedulerService");
// const fs = require("fs");
// const path = require("path");

// async function verifyReports() {
//   console.log("--- Scheduled Reports Verification ---");

//   try {
//     // 1. Check database for schedules
//     console.log("Step 1: Checking database for report schedules...");
//     const [schedules] = await pool.query("SELECT * FROM report_schedules");

//     if (schedules.length === 0) {
//       console.log(
//         "❌ Error: No report schedules found. Please create one in the dashboard first."
//       );
//       process.exit(1);
//     }

//     console.log(`✅ Found ${schedules.length} schedules.`);

//     // 2. Pick a schedule (prefer withholding_tax or debt)
//     const schedule =
//       schedules.find(
//         (s) => s.report_type === "debt" || s.report_type === "withholding_tax"
//       ) || schedules[0];
//     console.log(`\nStep 2: Selecting schedule for test execution:`);
//     console.log(`   - Name: ${schedule.name}`);
//     console.log(`   - Type: ${schedule.report_type}`);
//     console.log(`   - Frequency: ${schedule.frequency}`);
//     console.log(`   - Recipients: ${schedule.recipients}`);

//     // 3. Execute the report
//     console.log("\nStep 3: Triggering execution...");

//     // We force a wider date range by temporarily modifying the frequency to 'monthly' for the test
//     const testSchedule = { ...schedule, frequency: "monthly" };

//     await SchedulerService.executeReport(testSchedule);

//     console.log("\nStep 4: Verification process finished.");
//     console.log(
//       "If you see 'Report Email sent' above, the test was successful."
//     );
//     console.log("Cleaned up temporary files successfully.");

//     process.exit(0);
//   } catch (error) {
//     console.error("\n❌ Verification failed with error:");
//     console.error(error);
//     process.exit(1);
//   }
// }

// verifyReports();
