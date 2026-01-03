const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const authenticate = require("../middleware/authenticate");

router.use(authenticate);

router.post("/", paymentController.recordPayment);
router.get("/history", paymentController.getHistory);
router.get("/pending", paymentController.getPendingPayments);
router.get("/accumulated", paymentController.getAccumulatedPayments);
router.get("/export-pending", paymentController.exportPendingPayments);

router.put("/:paymentId/confirm", paymentController.confirmPayment);

module.exports = router;
