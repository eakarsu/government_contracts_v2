const { Pool } = require('pg');
const AIService = require('./aiService');
const logger = require('../utils/logger');

class SemanticSearchService {
  constructor() {
    this.aiService = AIService;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async indexContract(contractId, content) {
    try {
      // Generate embedding for contract content
      const embedding = await this.aiService.generateEmbedding(content);
      
      // Generate summary
      const summary = await this.aiService.summarizeDocument(content);
      
      // Extract metadata
      const metadata = {
        contentLength: content.length,
        indexedAt: new Date().toISOString()
      };

      // Store in database
      const query = `
        INSERT INTO contract_embeddings (contract_id, embedding, content_summary, metadata)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (contract_id) 
        DO UPDATE SET 
          embedding = EXCLUDED.embedding,
          content_summary = EXCLUDED.content_summary,
          metadata = EXCLUDED.metadata,
          created_at = NOW()
      `;

      await this.pool.query(query, [contractId, JSON.stringify(embedding), summary, JSON.stringify(metadata)]);
      
      logger.info(`Contract ${contractId} indexed successfully`);
      return { success: true, summary };
    } catch (error) {
      logger.error('Error indexing contract:', error);
      throw error;
    }
  }

  async semanticSearch(queryText, options = {}) {
    try {
      const {
        limit = 20,
        threshold = 0.7,
        filters = {},
        userId = null
      } = options;

      // Generate embedding for search query
      const queryEmbedding = await this.aiService.generateEmbedding(queryText);

      // Store search query if user provided
      if (userId) {
        await this.pool.query(
          'INSERT INTO search_queries (user_id, query_text, query_embedding) VALUES ($1, $2, $3)',
          [userId, queryText, JSON.stringify(queryEmbedding)]
        );
      }

      // Build search query with filters
      let searchQuery = `
        SELECT 
          c.id,
          c.notice_id,
          c.title,
          c.description,
          c.agency,
          c.contract_value,
          c.posted_date,
          ce.content_summary,
          ce.embedding <=> $1::vector as similarity_score
        FROM contracts c
        JOIN contract_embeddings ce ON c.id = ce.contract_id
        WHERE ce.embedding <=> $1::vector < $2
      `;

      const queryParams = [JSON.stringify(queryEmbedding), 1 - threshold];
      let paramIndex = 3;

      // Add filters
      if (filters.agency) {
        searchQuery += ` AND c.agency ILIKE $${paramIndex}`;
        queryParams.push(`%${filters.agency}%`);
        paramIndex++;
      }

      if (filters.minValue) {
        searchQuery += ` AND c.contract_value >= $${paramIndex}`;
        queryParams.push(filters.minValue);
        paramIndex++;
      }

      if (filters.maxValue) {
        searchQuery += ` AND c.contract_value <= $${paramIndex}`;
        queryParams.push(filters.maxValue);
        paramIndex++;
      }

      if (filters.dateFrom) {
        searchQuery += ` AND c.posted_date >= $${paramIndex}`;
        queryParams.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.contractType) {
        searchQuery += ` AND c.contract_type = $${paramIndex}`;
        queryParams.push(filters.contractType);
        paramIndex++;
      }

      searchQuery += ` ORDER BY similarity_score ASC LIMIT $${paramIndex}`;
      queryParams.push(limit);

      const result = await this.pool.query(searchQuery, queryParams);

      // Update search query with results count
      if (userId) {
        await this.pool.query(
          'UPDATE search_queries SET results_count = $1 WHERE user_id = $2 AND query_text = $3 ORDER BY created_at DESC LIMIT 1',
          [result.rows.length, userId, queryText]
        );
      }

      return {
        results: result.rows.map(row => ({
          ...row,
          relevanceScore: Math.max(0, 1 - row.similarity_score)
        })),
        totalResults: result.rows.length,
        query: queryText
      };
    } catch (error) {
      logger.error('Error performing semantic search:', error);
      throw error;
    }
  }

  async getSearchSuggestions(partialQuery, limit = 5) {
    try {
      // Get recent similar searches
      const query = `
        SELECT DISTINCT query_text, COUNT(*) as frequency
        FROM search_queries 
        WHERE query_text ILIKE $1
        GROUP BY query_text
        ORDER BY frequency DESC, MAX(created_at) DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [`%${partialQuery}%`, limit]);
      return result.rows.map(row => row.query_text);
    } catch (error) {
      logger.error('Error getting search suggestions:', error);
      return [];
    }
  }

  async getSearchHistory(userId, limit = 10) {
    try {
      const query = `
        SELECT query_text, results_count, created_at
        FROM search_queries
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting search history:', error);
      return [];
    }
  }

  async hybridSearch(queryText, options = {}) {
    try {
      // Perform both semantic and keyword search
      const semanticResults = await this.semanticSearch(queryText, options);
      
      // Keyword search
      const keywordQuery = `
        SELECT 
          c.id,
          c.notice_id,
          c.title,
          c.description,
          c.agency,
          c.contract_value,
          c.posted_date,
          ts_rank(to_tsvector('english', c.title || ' ' || COALESCE(c.description, '')), plainto_tsquery('english', $1)) as keyword_score
        FROM contracts c
        WHERE to_tsvector('english', c.title || ' ' || COALESCE(c.description, '')) @@ plainto_tsquery('english', $1)
        ORDER BY keyword_score DESC
        LIMIT $2
      `;

      const keywordResult = await this.pool.query(keywordQuery, [queryText, options.limit || 20]);

      // Combine and deduplicate results
      const combinedResults = new Map();

      // Add semantic results with higher weight
      semanticResults.results.forEach(result => {
        combinedResults.set(result.id, {
          ...result,
          combinedScore: result.relevanceScore * 0.7
        });
      });

      // Add keyword results
      keywordResult.rows.forEach(result => {
        if (combinedResults.has(result.id)) {
          // Boost existing result
          const existing = combinedResults.get(result.id);
          existing.combinedScore += result.keyword_score * 0.3;
        } else {
          combinedResults.set(result.id, {
            ...result,
            relevanceScore: result.keyword_score,
            combinedScore: result.keyword_score * 0.3
          });
        }
      });

      // Sort by combined score
      const finalResults = Array.from(combinedResults.values())
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, options.limit || 20);

      return {
        results: finalResults,
        totalResults: finalResults.length,
        query: queryText,
        searchType: 'hybrid'
      };
    } catch (error) {
      logger.error('Error performing hybrid search:', error);
      throw error;
    }
  }
}

module.exports = SemanticSearchService;
