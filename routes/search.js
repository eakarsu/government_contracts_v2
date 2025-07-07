const express = require('express');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');

const router = express.Router();

// Search contracts endpoint - consolidated from documentSearch.js
router.post('/', async (req, res) => {
  try {
    const startTime = Date.now();
    const { query, limit = 10, use_vector = true, include_analysis = false } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    let contracts = [];

    if (use_vector && vectorService.isConnected) {
      // Use vector search
      try {
        const vectorResults = await vectorService.searchContracts(query, limit);
        
        if (vectorResults.length > 0) {
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
        } else {
          use_vector = false;
        }
      } catch (vectorError) {
        console.warn('Vector search failed, falling back to database search:', vectorError);
        use_vector = false;
      }
    } else if (use_vector && !vectorService.isConnected) {
      console.warn('Vector search requested but ChromaDB not connected, falling back to database search');
      use_vector = false;
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

    let response = {
      query,
      results: {
        contracts: contracts,
        total_results: contracts.length
      },
      response_time: responseTime,
      search_method: use_vector ? 'vector' : 'database'
    };

    // Add AI analysis if requested (from documentSearch.js functionality)
    if (include_analysis && contracts.length > 0) {
      try {
        const summaryService = require('../services/summaryService');
        const analysisPrompt = `Analyze these government contract search results for query "${query}":

${contracts.slice(0, 5).map(c => `- ${c.title} (${c.agency}): ${c.description?.substring(0, 200)}...`).join('\n')}

Provide a brief analysis of the search results including key themes, agencies involved, and potential opportunities.`;

        const analysisResult = await summaryService.summarizeContent(
          analysisPrompt,
          process.env.REACT_APP_OPENROUTER_KEY
        );

        if (analysisResult.success) {
          response.ai_analysis = {
            summary: analysisResult.result.summary || 'Analysis completed',
            key_points: analysisResult.result.key_points || [],
            recommendations: analysisResult.result.recommendations || []
          };
        }
      } catch (analysisError) {
        console.warn('AI analysis failed:', analysisError.message);
      }
    }

    res.json(response);

  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
