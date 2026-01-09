const router = require("express").Router();
const reportsController = require("../controllers/reportsController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

// Compliance Reports
router.get(
  "/withholding-tax",
  authenticate,
  reportsController.getWithholdingTaxReport
);
router.get(
  "/tin-verification-log",
  authenticate,
  reportsController.getTINVerificationLog
);
router.get(
  "/compliance-summary",
  authenticate,
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
  authorize("admin"),
  reportsController.getSchedules
);
router.post(
  "/schedules",
  authenticate,
  authorize("admin"),
  reportsController.createSchedule
);
router.put(
  "/schedules/:id",
  authenticate,
  authorize("admin"),
  reportsController.updateSchedule
);
router.delete(
  "/schedules/:id",
  authenticate,
  authorize("admin"),
  reportsController.deleteSchedule
);

module.exports = router;
