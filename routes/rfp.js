const express = require('express');

const router = express.Router();

router.use((req, res) => {
  res.status(410).json({
    error: 'The mock-backed RFP generator is disabled until it has authoritative inputs and release checks.',
  });
});

module.exports = router;
