const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const authenticate = require('../middleware/authenticate');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname) !== '.xlsx') {
            return cb(new Error('Only .xlsx files are allowed'));
        }
        cb(null, true);
    }
});

router.use(authenticate);

router.post('/validate', upload.single('file'), uploadController.validateExcel);
router.post('/excel', upload.single('file'), uploadController.importExcel);
router.get('/history', uploadController.getHistory);

module.exports = router;
