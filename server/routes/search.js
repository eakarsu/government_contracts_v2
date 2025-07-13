const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const embeddingService = require('../services/embeddingService');
const auth = require('../middleware/auth');

// Initialize Chroma on startup
embeddingService.initializeChroma().catch(console.error);

// POST /api/search - Hybrid semantic + keyword search
router.post('/', async (req, res) => {
  try {
    const { 
      query, 
      filters = {}, 
      options = {} 
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Perform hybrid search
    const searchResults = await searchService.hybridSearch(query, filters, options);

    // Save search query if user is authenticated
    if (req.user) {
      try {
        await searchService.saveSearchQuery(
          req.user.id, 
          query, 
          searchResults.results.length
        );
      } catch (error) {
        console.error('Error saving search query:', error);
        // Don't fail the request if saving search history fails
      }
    }

    res.json(searchResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during search'
    });
  }
});

// GET /api/search/suggestions - Get search suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { q: partialQuery, limit = 5 } = req.query;

    if (!partialQuery || partialQuery.length < 2) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    const suggestions = await searchService.getSearchSuggestions(partialQuery, limit);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search suggestions'
    });
  }
});

// GET /api/search/history - Get user's search history
router.get('/history', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const history = await searchService.getSearchHistory(req.user.id, limit);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error getting search history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search history'
    });
  }
});

// POST /api/search/expand-query - Expand search query with AI
router.post('/expand-query', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const expandedTerms = await embeddingService.expandQuery(query);

    res.json({
      success: true,
      original_query: query,
      expanded_terms: expandedTerms
    });
  } catch (error) {
    console.error('Error expanding query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to expand query'
    });
  }
});

// POST /api/search/index-contract - Index a contract for semantic search
router.post('/index-contract', auth, async (req, res) => {
  try {
    const { contractId, content, metadata = {} } = req.body;

    if (!contractId || !content) {
      return res.status(400).json({
        success: false,
        error: 'Contract ID and content are required'
      });
    }

    const result = await embeddingService.addContractEmbedding(contractId, content, metadata);

    res.json(result);
  } catch (error) {
    console.error('Error indexing contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to index contract'
    });
  }
});

module.exports = router;
