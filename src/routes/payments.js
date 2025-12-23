const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.post('/', paymentController.recordPayment);
router.get('/history', paymentController.getHistory);

module.exports = router;
