const router = require("express").Router();
const analyticsController = require("../controllers/analyticsController");
const authenticate = require("../middleware/authenticate");

// Financial Analytics
router.get(
  "/financial-overview",
  authenticate,
  analyticsController.getFinancialOverview
);
router.get(
  "/revenue-trends",
  authenticate,
  analyticsController.getRevenueTrends
);
router.get("/tax-analytics", authenticate, analyticsController.getTaxAnalytics);
router.get(
  "/payout-velocity",
  authenticate,
  analyticsController.getPayoutVelocity
);

// Driver Analytics
router.get(
  "/driver-performance",
  authenticate,
  analyticsController.getDriverPerformance
);
router.get(
  "/driver-segmentation",
  authenticate,
  analyticsController.getDriverSegmentation
);
router.get(
  "/earnings-distribution",
  authenticate,
  analyticsController.getEarningsDistribution
);

module.exports = router;
