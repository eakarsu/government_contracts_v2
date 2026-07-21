const express = require('express');

const router = express.Router();

router.use((req, res) => {
  res.status(410).json({
    code: 'NON_DETERMINISTIC_RECOMMENDATIONS_DISABLED',
    error: 'Legacy recommendations are disabled because their scores were random and not evidence-backed.',
  });
});

module.exports = router;
