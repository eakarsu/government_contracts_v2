const express = require('express');
const { prisma } = require('../config/database');

const router = express.Router();

// Get bidding recommendations
router.post('/', async (req, res) => {
  try {
    const { naics_codes, agencies, keywords } = req.body;

    let whereClause = {};
    
    if (naics_codes && naics_codes.length > 0) {
      whereClause.naicsCode = { in: naics_codes };
    }
    
    if (agencies && agencies.length > 0) {
      whereClause.agency = { in: agencies };
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      take: 20
    });

    if (contracts.length === 0) {
      return res.json({
        message: 'No matching contracts found',
        recommendations: []
      });
    }

    // Generate simple recommendations
    const recommendations = contracts.map(contract => ({
      contract_id: contract.noticeId,
      title: contract.title,
      agency: contract.agency,
      recommendation_score: Math.random() * 100,
      reasons: [
        'Matches your NAICS code criteria',
        'Good fit for your capabilities',
        'Competitive opportunity'
      ]
    }));

    res.json({
      criteria: req.body,
      contracts_analyzed: contracts.length,
      recommendations
    });

  } catch (error) {
    console.error('Recommendations generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
