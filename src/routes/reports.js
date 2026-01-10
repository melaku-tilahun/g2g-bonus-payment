const router = require("express").Router();
const reportsController = require("../controllers/reportsController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

// Compliance Reports
router.get(
  "/withholding-tax",
  authenticate,
  authorize(["admin", "director", "auditor"]),
  reportsController.getWithholdingTaxReport
);
router.get(
  "/tin-verification-log",
  authenticate,
  authorize(["admin", "director", "auditor"]),
  reportsController.getTINVerificationLog
);
router.get(
  "/compliance-summary",
  authenticate,
  authorize(["admin", "director", "auditor"]),
  reportsController.getComplianceSummary
);
router.get(
  "/driver-statement/:driverId",
  authenticate,
  reportsController.generateDriverStatement
);

// Report Schedules (Admin Only)
router.get(
  "/schedules",
  authenticate,
  authorize(["admin", "director"]),
  reportsController.getSchedules
);
router.post(
  "/schedules",
  authenticate,
  authorize(["admin", "director"]),
  reportsController.createSchedule
);
router.put(
  "/schedules/:id",
  authenticate,
  authorize(["admin", "director"]),
  reportsController.updateSchedule
);
router.delete(
  "/schedules/:id",
  authenticate,
  authorize(["admin", "director"]),
  reportsController.deleteSchedule
);

module.exports = router;
