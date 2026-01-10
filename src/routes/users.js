const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

router.use(authenticate);
// router.use(authorize(["admin", "director"])); // Removed global restriction

router.get(
  "/",
  authorize(["admin", "director", "manager", "auditor"]),
  userController.getAll
);
router.post("/", authorize(["admin", "director"]), userController.create);
router.put("/:id", authorize(["admin", "director"]), userController.update);
router.delete(
  "/:id",
  authorize(["admin", "director"]),
  userController.deactivate
);

module.exports = router;
