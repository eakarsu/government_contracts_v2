const express = require('express');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');

const router = express.Router();

// Search contracts endpoint
router.post('/', async (req, res) => {
  try {
    const startTime = Date.now();
    const { query, limit = 10, use_vector = true } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    let contracts = [];

    if (use_vector) {
      // Use vector search
      try {
        const vectorResults = await vectorService.searchContracts(query, limit);
        
        // Get full contract details from database
        const contractIds = vectorResults.map(r => r.id);
        contracts = await prisma.contract.findMany({
          where: { noticeId: { in: contractIds } },
          orderBy: { postedDate: 'desc' }
        });

        // Add similarity scores
        contracts = contracts.map(contract => {
          const vectorResult = vectorResults.find(r => r.id === contract.noticeId);
          return {
            ...contract,
            similarity_score: vectorResult?.score || 0
          };
        });
      } catch (vectorError) {
        console.warn('Vector search failed, falling back to database search:', vectorError);
        use_vector = false;
      }
    }

    if (!use_vector || contracts.length === 0) {
      // Fallback to database search
      contracts = await prisma.contract.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { agency: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: Math.min(limit, 50),
        orderBy: { postedDate: 'desc' }
      });
    }

    const responseTime = (Date.now() - startTime) / 1000;

    // Log search query
    await prisma.searchQuery.create({
      data: {
        queryText: query,
        resultsCount: contracts.length,
        responseTime,
        userIp: req.ip
      }
    });

    res.json({
      query,
      results: {
        contracts: contracts,
        total_results: contracts.length
      },
      response_time: responseTime,
      search_method: use_vector ? 'vector' : 'database'
    });

  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
