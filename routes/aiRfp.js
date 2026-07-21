const express = require('express');

const router = express.Router();

router.use((req, res) => {
  res.status(410).json({
    code: 'NON_AUTHORITATIVE_RFP_WORKFLOW_DISABLED',
    error: 'Legacy AI RFP generation is disabled because it can return placeholder or non-authoritative content.',
    next: 'Use /api/governance for evidence-backed compliance decisions.',
  });
});

module.exports = router;
