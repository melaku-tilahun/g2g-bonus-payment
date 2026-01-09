const express = require("express");
const router = express.Router();
const debtController = require("../controllers/debtController");
const authenticate = require("../middleware/authenticate");

router.use(authenticate);

const authorize = require("../middleware/authorize"); // Correct path

// Create new debt (Admin only)
router.post("/", authorize("admin"), debtController.createDebt);

// Search debts
router.get("/search", debtController.search);

// Debt Analytics (Admin only)
router.get(
  "/analytics/overview",
  authorize("admin"),
  debtController.getDebtOverview
);
router.get(
  "/analytics/aging",
  authorize("admin"),
  debtController.getAgingReport
);
router.get(
  "/analytics/trends",
  authorize("admin"),
  debtController.getRepaymentTrends
);

// Get debts for a driver
router.get("/driver/:driverId", debtController.getDebtsByDriver);

module.exports = router;
