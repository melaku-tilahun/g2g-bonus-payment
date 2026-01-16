const express = require("express");
const router = express.Router();
const multer = require("multer");
const importController = require("../controllers/importController");
const authenticate = require("../middleware/authenticate");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
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
    cb(null, Date.now() + path.extname(file.originalname));
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

router.post("/validate", upload.single("file"), importController.validateExcel);
router.post("/excel", upload.single("file"), importController.importExcel);
router.get("/history", importController.getHistory);

module.exports = router;
