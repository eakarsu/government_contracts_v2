const express = require('express');
const { Pool } = require('pg');
const AIService = require('../services/aiService');
const SemanticSearchService = require('../services/semanticSearchService');
const OpportunityMatchingService = require('../services/opportunityMatchingService');
const logger = require('../utils/logger');

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const semanticSearchService = new SemanticSearchService();
const opportunityMatchingService = new OpportunityMatchingService();

// Initialize services
(async () => {
  try {
    await semanticSearchService.initialize();
    logger.info('Semantic search service initialized');
  } catch (error) {
    logger.warn('Failed to initialize semantic search service:', error.message);
  }
})();

// Semantic search endpoint
router.post('/semantic', async (req, res) => {
  try {
    const { query, filters = {}, limit = 20, threshold = 0.7 } = req.body;
    const userId = req.user?.id;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Search query is required' 
      });
    }

    const results = await semanticSearchService.semanticSearch(query, {
      limit,
      threshold,
      filters,
      userId
    });

    // Ensure the response has the expected format
    res.json({
      success: true,
      query: results.query,
      results: {
        contracts: results.results || [],
        total_results: results.totalResults || 0
      },
      search_method: results.searchType,
      response_time: 0.1
    });
  } catch (error) {
    logger.error('Semantic search error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Search failed' 
    });
  }
});

// Hybrid search endpoint
router.post('/hybrid', async (req, res) => {
  try {
    const { query, filters = {}, limit = 20, threshold = 0.7 } = req.body;
    const userId = req.user?.id;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Search query is required' 
      });
    }

    const results = await semanticSearchService.hybridSearch(query, {
      limit,
      threshold,
      filters,
      userId
    });

    // Ensure the response has the expected format
    res.json({
      success: true,
      query: results.query,
      results: {
        contracts: results.results || [],
        total_results: results.totalResults || 0
      },
      search_method: results.searchType,
      response_time: 0.1
    });
  } catch (error) {
    logger.error('Hybrid search error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Search failed' 
    });
  }
});

// Search suggestions endpoint
router.get('/suggestions', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const suggestions = await semanticSearchService.getSearchSuggestions(q, limit);
    res.json(suggestions);
  } catch (error) {
    logger.error('Search suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Search history endpoint
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const history = await semanticSearchService.getSearchHistory(userId, limit);
    res.json(history);
  } catch (error) {
    logger.error('Search history error:', error);
    res.status(500).json({ error: 'Failed to get search history' });
  }
});

// Business profile endpoints
router.post('/profile', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const profile = await opportunityMatchingService.createBusinessProfile(userId, req.body);
    res.status(201).json(profile);
  } catch (error) {
    logger.error('Create business profile error:', error);
    res.status(500).json({ error: 'Failed to create business profile' });
  }
});

router.put('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await opportunityMatchingService.updateBusinessProfile(id, req.body);
    res.json(profile);
  } catch (error) {
    logger.error('Update business profile error:', error);
    res.status(500).json({ error: 'Failed to update business profile' });
  }
});

// Opportunity matching endpoints
router.get('/opportunities/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { limit = 20, minScore = 0.5, sortBy = 'match_score' } = req.query;

    const opportunities = await opportunityMatchingService.getMatchedOpportunities(
      profileId,
      { limit: parseInt(limit), minScore: parseFloat(minScore), sortBy }
    );

    res.json(opportunities);
  } catch (error) {
    logger.error('Get opportunities error:', error);
    res.status(500).json({ error: 'Failed to get opportunities' });
  }
});

router.post('/match/:profileId/:contractId', async (req, res) => {
  try {
    const { profileId, contractId } = req.params;
    
    const match = await opportunityMatchingService.calculateOpportunityMatch(
      profileId,
      contractId
    );

    res.json(match);
  } catch (error) {
    logger.error('Calculate match error:', error);
    res.status(500).json({ error: 'Failed to calculate match' });
  }
});

// Debug endpoint to test vector search directly
router.get('/debug/vector/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 5 } = req.query;

    logger.info(`Debug vector search for: "${query}"`);

    // Get vector service stats first
    const stats = await semanticSearchService.vectorService.getCollectionStats();
    
    // Try direct vector search
    const vectorResults = await semanticSearchService.vectorService.searchContracts(query, {
      limit: parseInt(limit),
      threshold: 0.001 // Very low threshold
    });

    res.json({
      query,
      vector_stats: stats,
      raw_results: vectorResults,
      debug_info: {
        vector_connected: semanticSearchService.vectorService.isConnected,
        embedding_model_loaded: !!semanticSearchService.vectorService.embedder
      }
    });
  } catch (error) {
    logger.error('Debug vector search error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Legacy search endpoint for backward compatibility
router.post('/', async (req, res) => {
  try {
    const startTime = Date.now();
    const { query, limit = 10, use_vector = true, include_analysis = false } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    logger.info(`Search request: "${query}" with limit ${limit}`);

    // Use hybrid search by default for better results
    const searchResults = await semanticSearchService.hybridSearch(query, {
      limit,
      threshold: 0.01, // Much lower threshold to see all results
      filters: {},
      userId: req.user?.id
    });
    
    logger.info(`Search completed: found ${searchResults.results?.length || 0} results using ${searchResults.searchType}`);

    const responseTime = (Date.now() - startTime) / 1000;

    let response = {
      success: true,
      query,
      results: {
        contracts: searchResults.results || [],
        total_results: searchResults.totalResults || 0
      },
      response_time: responseTime,
      search_method: searchResults.searchType || 'hybrid'
    };

    // Add AI analysis if requested
    if (include_analysis && searchResults.results?.length > 0) {
      try {
        const analysisPrompt = `Analyze these government contract search results for query "${query}":

${searchResults.results.slice(0, 5).map(c => `- ${c.title} (${c.agency}): ${c.description?.substring(0, 200)}...`).join('\n')}

Provide a brief analysis of the search results including key themes, agencies involved, and potential opportunities.`;

        const analysisResult = await AIService.generateChatCompletion([
          { role: 'system', content: 'You are an expert at analyzing government contract opportunities.' },
          { role: 'user', content: analysisPrompt }
        ]);

        response.ai_analysis = {
          summary: analysisResult,
          key_points: [],
          recommendations: []
        };
      } catch (analysisError) {
        logger.warn('AI analysis failed:', analysisError.message);
      }
    }

    res.json(response);

  } catch (error) {
    logger.error('Search failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
