const express = require('express');

const router = express.Router();

router.use((req, res) => {
  res.status(410).json({
    error: 'AI-generated compliance checklists are advisory and cannot be released as decisions.',
    replacement: '/api/governance',
  });
});

module.exports = router;
