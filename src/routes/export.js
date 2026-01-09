const router = require("express").Router();
const exportController = require("../controllers/exportController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

router.post("/drivers", authenticate, exportController.exportDrivers);
router.post("/payments", authenticate, exportController.exportPayments);
router.post(
  "/audit-logs",
  authenticate,
  authorize("admin"),
  exportController.exportAuditLogs
);
router.post(
  "/backup",
  authenticate,
  authorize("admin"),
  exportController.createBackup
);

module.exports = router;
