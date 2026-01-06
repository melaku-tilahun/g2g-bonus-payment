const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const authenticate = require("../middleware/authenticate");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
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

router.post("/", paymentController.recordPayment);
router.post(
  "/reconcile/validate",
  upload.single("file"),
  paymentController.validateReconciliation
);
router.post("/reconcile/process", paymentController.processReconciliation);
router.get("/history", paymentController.getHistory);
router.get("/pending", paymentController.getPendingPayments);
router.get("/accumulated", paymentController.getAccumulatedPayments);
router.get("/export/pending", paymentController.exportPendingPayments);
router.get("/batches", paymentController.getBatches);
router.get("/batches/:batchId/download", paymentController.downloadBatchExcel);

router.put("/:paymentId/confirm", paymentController.confirmPayment);

module.exports = router;
