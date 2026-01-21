const express = require("express");
const router = express.Router();
const paymentHistoryController = require("../controllers/payments/paymentHistoryController");
const pendingPaymentController = require("../controllers/payments/pendingPaymentController");
const reconciliationController = require("../controllers/payments/reconciliationController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const importDir = path.join(__dirname, "../../imports");
if (!fs.existsSync(importDir)) {
  fs.mkdirSync(importDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, importDir);
  },
  filename: (req, file, cb) => {
    cb(null, "reconcile_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) !== ".xlsx") {
      return cb(new Error("Only .xlsx files are allowed"));
    }
    cb(null, true);
  },
});

router.use(authenticate);

router.post(
  "/",
  authorize(["admin", "director", "manager", "staff"]),
  paymentHistoryController.recordPayment,
);
router.post(
  "/reconcile/validate",
  authorize(["admin", "director", "manager", "staff"]),
  upload.single("file"),
  reconciliationController.validateReconciliation,
);
router.post(
  "/reconcile/process",
  authorize(["admin", "director", "manager", "staff"]),
  reconciliationController.processReconciliation,
);
router.get("/search", paymentHistoryController.search);
router.get("/history", paymentHistoryController.getHistory);
router.get("/pending", pendingPaymentController.getPendingPayments);
router.get("/accumulated", pendingPaymentController.getAccumulatedPayments);
router.get(
  "/export/pending",
  authorize(["admin", "director", "manager", "staff"]),
  pendingPaymentController.exportPendingPayments,
);
router.get("/batches", pendingPaymentController.getBatches);
router.get(
  "/batches/:batchId/download",
  authorize(["admin", "director", "manager", "staff"]),
  pendingPaymentController.downloadBatchExcel,
);

router.put(
  "/:paymentId/confirm",
  authorize(["admin", "director", "manager", "staff"]),
  paymentHistoryController.confirmPayment,
);
router.post(
  "/:paymentId/revert",
  authorize(["admin", "director"]),
  paymentHistoryController.revertPayment,
);

module.exports = router;
