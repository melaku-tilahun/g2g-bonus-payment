const router = require("express").Router();
const batchController = require("../controllers/batchController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

router.get("/", authenticate, authorize("admin"), batchController.getBatches);
router.get(
  "/:id",
  authenticate,
  authorize("admin"),
  batchController.getBatchDetails
);
router.put(
  "/:id/confirm",
  authenticate,
  authorize("admin"),
  batchController.confirmBatch
);

module.exports = router;
