const express = require('express');

const router = express.Router();

router.use((req, res) => {
  res.status(410).json({
    error: 'Mock bid predictions are disabled. No validated prediction model is configured.',
  });
});

module.exports = router;
