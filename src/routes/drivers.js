const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driverController");
const statementController = require("../controllers/statementController");
const authorize = require("../middleware/authorize");
const authenticate = require("../middleware/authenticate");

router.use(authenticate);

router.get("/", driverController.getAll);
router.get("/search", driverController.search);
router.get("/tin/:tin", driverController.lookupTIN);
router.get("/:id", driverController.getById);
router.put("/:id/verify", driverController.verify);

// Admin Features
router.put(
  "/:id/block",
  authorize("admin"),
  driverController.toggleBlockStatus
);

router.post(
  "/:id/payout-unverified",
  authorize("admin"),
  driverController.releaseUnverifiedPayout
);

router.get("/:id/statement", statementController.getStatement);

module.exports = router;
