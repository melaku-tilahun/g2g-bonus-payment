const router = require("express").Router();
const auditController = require("../controllers/auditController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

router.get(
  "/activity-report",
  authenticate,
  authorize("admin"),
  auditController.getActivityReport
);
router.get(
  "/user-summary",
  authenticate,
  authorize("admin"),
  auditController.getUserActivitySummary
);
router.get(
  "/activity-heatmap",
  authenticate,
  authorize("admin"),
  auditController.getActivityHeatmap
);
router.get(
  "/security-events",
  authenticate,
  authorize("admin"),
  auditController.getSecurityEvents
);

module.exports = router;
