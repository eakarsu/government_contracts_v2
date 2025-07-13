const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// @route   POST /api/ai/search/semantic
// @desc    Perform semantic search on contracts
// @access  Public (for now)
router.post('/semantic', async (req, res) => {
  try {
    const { query, filters = {}, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // For now, do a basic text search until AI service is fully integrated
    let searchQuery = `
      SELECT id as contract_id, title, agency, description, 
             estimated_value, deadline, set_aside_type,
             0.8 as similarity
      FROM contracts 
      WHERE title ILIKE $1 OR description ILIKE $1
    `;
    const params = [`%${query}%`];

    // Apply filters
    if (filters.agency) {
      searchQuery += ' AND agency ILIKE $' + (params.length + 1);
      params.push(`%${filters.agency}%`);
    }
    if (filters.minValue) {
      searchQuery += ' AND estimated_value >= $' + (params.length + 1);
      params.push(filters.minValue);
    }
    if (filters.maxValue) {
      searchQuery += ' AND estimated_value <= $' + (params.length + 1);
      params.push(filters.maxValue);
    }

    searchQuery += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await pool.query(searchQuery, params);

    res.json({
      query,
      results: result.rows,
      total: result.rows.length,
      semantic: true
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// @route   GET /api/ai/search/suggestions
// @desc    Get search suggestions based on query
// @access  Public
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    // Get common contract terms
    const contractTerms = await pool.query(
      `SELECT DISTINCT title
       FROM contracts 
       WHERE title ILIKE $1
       LIMIT 5`,
      [`%${q}%`]
    );

    const suggestions = contractTerms.rows.map(r => r.title);

    res.json({ suggestions: suggestions.slice(0, 8) });

  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

module.exports = router;
