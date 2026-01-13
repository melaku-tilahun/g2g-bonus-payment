const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");

router.post("/login", authController.login);
router.post("/verify-otp", authController.verifyOTP);
router.get("/me", authenticate, authController.getMe);
router.post("/change-password", authenticate, authController.changePassword);

module.exports = router;
