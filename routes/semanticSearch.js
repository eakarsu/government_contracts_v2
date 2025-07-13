const express = require('express');
const { query } = require('../config/database');
const aiService = require('../services/aiService');
const { logger } = require('../utils/logger');
const { aiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply AI rate limiting to all routes
router.use(aiRateLimiter);

// Semantic search endpoint
router.post('/search', async (req, res) => {
  try {
    const { queryText, filters = {}, limit = 10, threshold = 0.7 } = req.body;

    if (!queryText || queryText.trim().length === 0) {
      return res.status(400).json({ error: 'Query text is required' });
    }

    logger.info(`Semantic search query: "${queryText}" by user ${req.user.id}`);

    // Generate embedding for the search query
    const queryEmbedding = await aiService.generateEmbedding(queryText);

    // Store search query for analytics
    await query(
      'INSERT INTO search_queries (user_id, query_text, query_embedding) VALUES ($1, $2, $3)',
      [req.user.id, queryText, queryEmbedding]
    );

    // Build SQL query with filters
    let sqlQuery = `
      SELECT 
        c.*,
        ce.embedding,
        ce.content_summary,
        (1 - (ce.embedding <=> $1::vector)) as similarity
      FROM contracts c
      LEFT JOIN contract_embeddings ce ON c.id = ce.contract_id
      WHERE ce.embedding IS NOT NULL
    `;
    
    const queryParams = [queryEmbedding];
    let paramIndex = 2;

    // Apply filters
    if (filters.agency) {
      sqlQuery += ` AND c.agency ILIKE $${paramIndex}`;
      queryParams.push(`%${filters.agency}%`);
      paramIndex++;
    }

    if (filters.naicsCode) {
      sqlQuery += ` AND c.naics_code = $${paramIndex}`;
      queryParams.push(filters.naicsCode);
      paramIndex++;
    }

    if (filters.minValue) {
      sqlQuery += ` AND c.contract_value >= $${paramIndex}`;
      queryParams.push(filters.minValue);
      paramIndex++;
    }

    if (filters.maxValue) {
      sqlQuery += ` AND c.contract_value <= $${paramIndex}`;
      queryParams.push(filters.maxValue);
      paramIndex++;
    }

    if (filters.postedAfter) {
      sqlQuery += ` AND c.posted_date >= $${paramIndex}`;
      queryParams.push(filters.postedAfter);
      paramIndex++;
    }

    if (filters.deadlineBefore) {
      sqlQuery += ` AND c.response_deadline <= $${paramIndex}`;
      queryParams.push(filters.deadlineBefore);
      paramIndex++;
    }

    // Add similarity threshold and ordering
    sqlQuery += ` 
      AND (1 - (ce.embedding <=> $1::vector)) >= $${paramIndex}
      ORDER BY similarity DESC
      LIMIT $${paramIndex + 1}
    `;
    queryParams.push(threshold, limit);

    const result = await query(sqlQuery, queryParams);

    // Format results
    const searchResults = result.rows.map(row => ({
      id: row.id,
      noticeId: row.notice_id,
      title: row.title,
      description: row.description,
      agency: row.agency,
      naicsCode: row.naics_code,
      contractValue: row.contract_value,
      postedDate: row.posted_date,
      responseDeadline: row.response_deadline,
      similarity: Math.round(row.similarity * 100) / 100,
      contentSummary: row.content_summary
    }));

    // Update search query with results count
    await query(
      'UPDATE search_queries SET results_count = $1 WHERE user_id = $2 AND query_text = $3 AND created_at = (SELECT MAX(created_at) FROM search_queries WHERE user_id = $2 AND query_text = $3)',
      [searchResults.length, req.user.id, queryText]
    );

    res.json({
      query: queryText,
      results: searchResults,
      totalResults: searchResults.length,
      threshold,
      filters
    });

  } catch (error) {
    logger.error('Semantic search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Expand search query with AI
router.post('/expand-query', async (req, res) => {
  try {
    const { queryText } = req.body;

    if (!queryText || queryText.trim().length === 0) {
      return res.status(400).json({ error: 'Query text is required' });
    }

    const expandedTerms = await aiService.expandQuery(queryText);

    res.json({
      originalQuery: queryText,
      expandedTerms,
      suggestions: expandedTerms.slice(0, 10) // Top 10 suggestions
    });

  } catch (error) {
    logger.error('Query expansion error:', error);
    res.status(500).json({ error: 'Query expansion failed' });
  }
});

// Get search history for user
router.get('/history', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const result = await query(
      'SELECT query_text, results_count, created_at FROM search_queries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.user.id, limit]
    );

    res.json({
      searchHistory: result.rows.map(row => ({
        query: row.query_text,
        resultsCount: row.results_count,
        searchedAt: row.created_at
      }))
    });

  } catch (error) {
    logger.error('Search history error:', error);
    res.status(500).json({ error: 'Failed to retrieve search history' });
  }
});

module.exports = router;
