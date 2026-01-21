const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driverController");
const statementController = require("../controllers/statementController");
const authorize = require("../middleware/authorize");
const authenticate = require("../middleware/authenticate");

router.use(authenticate);

router.get("/", driverController.getAll);
router.post(
  "/",
  authorize(["admin", "director", "manager"]),
  driverController.createDriver,
);
router.get("/search", driverController.search);
router.get("/tin/:tin", driverController.lookupTIN);
router.put(
  "/:id",
  authorize(["admin", "director", "manager"]),
  driverController.updateDriver,
);
router.get("/:id", driverController.getById);
router.put(
  "/:id/verify",
  authorize(["admin", "director", "manager", "staff"]),
  driverController.verify,
);

// Admin Features
router.put(
  "/:id/block",
  authorize(["admin", "director", "manager"]),
  driverController.toggleBlockStatus,
);

router.post(
  "/:id/payout-unverified",
  authorize(["admin", "director"]),
  driverController.releaseUnverifiedPayout,
);

router.post(
  "/:id/verify-phone",
  authorize(["admin", "director", "manager"]),
  driverController.verifyDriverPhone,
);

router.get("/:id/statement", statementController.getStatement);

router.post("/:id/notes", driverController.addNote);

module.exports = router;
