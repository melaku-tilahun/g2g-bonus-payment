const express = require('express');
const router = express.Router();
const AuditService = require('../services/auditService');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const logs = await AuditService.getAll();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
