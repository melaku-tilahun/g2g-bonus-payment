const express = require('express');
const router = express.Router();
const bonusController = require('../controllers/bonusController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/driver/:driverId', bonusController.getByDriver);
router.get('/driver/:driverId/total', bonusController.getTotalByDriver);
router.get('/pending', bonusController.getPending);

module.exports = router;
