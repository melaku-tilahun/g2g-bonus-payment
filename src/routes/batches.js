const router = require("express").Router();
const batchController = require("../controllers/batchController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

// Read access: Admin, Director, Manager
router.get(
  "/",
  authenticate,
  authorize(["admin", "director", "manager"]),
  batchController.getBatches
);
router.get(
  "/:id",
  authenticate,
  authorize(["admin", "director", "manager"]),
  batchController.getBatchDetails
);

// Write access: Admin, Director (Mark Paid)
router.put(
  "/:id/confirm",
  authenticate,
  authorize(["admin", "director"]),
  batchController.confirmBatch
);

module.exports = router;
