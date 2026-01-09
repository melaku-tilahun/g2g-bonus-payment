const router = require("express").Router();
const notificationsController = require("../controllers/notificationsController");
const authenticate = require("../middleware/authenticate");

router.get("/", authenticate, notificationsController.getAll);
router.get(
  "/unread-count",
  authenticate,
  notificationsController.getUnreadCount
);
router.put("/:id/read", authenticate, notificationsController.markAsRead);
router.put("/read-all", authenticate, notificationsController.markAllAsRead);

module.exports = router;
