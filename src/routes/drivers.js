const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driverController");
const driverImportController = require("../controllers/driverImportController");
const statementController = require("../controllers/statementController");
const authorize = require("../middleware/authorize");
const authenticate = require("../middleware/authenticate");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure imports directory exists
const importDir = path.join(__dirname, "../../public/imports");
if (!fs.existsSync(importDir)) {
  fs.mkdirSync(importDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, importDir);
  },
  filename: (req, file, cb) => {
    cb(null, "driver_import_" + Date.now() + path.extname(file.originalname));
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

router.post(
  "/bulk-import",
  authorize(["admin", "director"]),
  upload.single("file"),
  driverImportController.importDrivers,
);

module.exports = router;

