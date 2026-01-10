const router = require("express").Router();
const auditController = require("../controllers/auditController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

// Update all routes to allow Director
router.get(
  "/activity-report",
  authenticate,
  authorize(["admin", "director"]),
  auditController.getActivityReport
);
router.get(
  "/user-summary",
  authenticate,
  authorize(["admin", "director"]),
  auditController.getUserActivitySummary
);
router.get(
  "/activity-heatmap",
  authenticate,
  authorize(["admin", "director"]),
  auditController.getActivityHeatmap
);
router.get(
  "/security-events",
  authenticate,
  authorize(["admin", "director"]),
  auditController.getSecurityEvents
);

module.exports = router;
