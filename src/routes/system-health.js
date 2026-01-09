const router = require("express").Router();
const systemHealthController = require("../controllers/systemHealthController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

router.get(
  "/dashboard",
  authenticate,
  authorize("admin"),
  systemHealthController.getDashboard
);
router.get(
  "/performance",
  authenticate,
  authorize("admin"),
  systemHealthController.getPerformanceMetrics
);
router.get(
  "/storage",
  authenticate,
  authorize("admin"),
  systemHealthController.getStorageStatus
);
router.get(
  "/errors",
  authenticate,
  authorize("admin"),
  systemHealthController.getErrorRates
);

module.exports = router;
