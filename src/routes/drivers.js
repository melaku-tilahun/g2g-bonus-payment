const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', driverController.getAll);
router.get('/search', driverController.search);
router.get('/:id', driverController.getById);
router.put('/:id/verify', driverController.verify);

module.exports = router;
