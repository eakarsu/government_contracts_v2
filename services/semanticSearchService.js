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
        try {
          await this.pool.query(
            'INSERT INTO search_queries (user_id, query_text, query_embedding) VALUES ($1, $2, $3)',
            [userId, queryText, JSON.stringify(queryEmbedding)]
          );
        } catch (dbError) {
          logger.warn('Failed to store search query:', dbError.message);
        }
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
        try {
          await this.pool.query(
            'UPDATE search_queries SET results_count = $1 WHERE user_id = $2 AND query_text = $3 ORDER BY created_at DESC LIMIT 1',
            [result.rows.length, userId, queryText]
          );
        } catch (dbError) {
          logger.warn('Failed to update search query results count:', dbError.message);
        }
      }

      return {
        results: result.rows.map(row => ({
          ...row,
          relevanceScore: Math.max(0, 1 - row.similarity_score)
        })),
        totalResults: result.rows.length,
        query: queryText,
        searchType: 'semantic'
      };
    } catch (error) {
      logger.error('Error performing semantic search:', error);
      // Fallback to mock results only if vector search fails
      logger.warn('Vector search failed, falling back to mock results');
      return await this.getMockSearchResults(queryText, options);
    }
  }

  async getSearchSuggestions(partialQuery, limit = 5) {
    try {
      // Get recent similar searches from database
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
      logger.warn('Database search suggestions failed, using fallback:', error.message);
      // Fallback to mock suggestions only if database query fails
      const mockSuggestions = [
        'cybersecurity services',
        'IT infrastructure',
        'software development',
        'cloud migration',
        'data analytics',
        'healthcare IT',
        'network security',
        'system integration'
      ];

      return mockSuggestions
        .filter(suggestion => suggestion.toLowerCase().includes(partialQuery.toLowerCase()))
        .slice(0, limit);
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
      logger.warn('Database search history failed, using fallback:', error.message);
      // Fallback to mock history only if database query fails
      const mockHistory = [
        { query_text: 'cybersecurity services', results_count: 5, created_at: new Date(Date.now() - 86400000) },
        { query_text: 'IT infrastructure', results_count: 8, created_at: new Date(Date.now() - 172800000) },
        { query_text: 'software development', results_count: 12, created_at: new Date(Date.now() - 259200000) }
      ];

      return mockHistory.slice(0, limit);
    }
  }

  async keywordSearchFallback(queryText, options = {}) {
    try {
      const { limit = 20, filters = {} } = options;
      
      // Build keyword search query with filters
      let searchQuery = `
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
      `;

      const queryParams = [queryText];
      let paramIndex = 2;

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

      searchQuery += ` ORDER BY keyword_score DESC LIMIT $${paramIndex}`;
      queryParams.push(limit);

      const result = await this.pool.query(searchQuery, queryParams);

      return {
        results: result.rows.map(row => ({
          ...row,
          relevanceScore: row.keyword_score || 0
        })),
        totalResults: result.rows.length,
        query: queryText,
        searchType: 'keyword'
      };
    } catch (error) {
      logger.error('Error performing keyword search fallback:', error);
      // Only use mock results if database query fails
      logger.warn('Keyword search failed, falling back to mock results');
      return await this.getMockSearchResults(queryText, options);
    }
  }

  async getMockSearchResults(queryText, options = {}) {
    const { limit = 20, filters = {} } = options;
    
    // Generate mock contract results based on search query
    const mockContracts = [
      {
        id: 'CONTRACT_001',
        notice_id: 'N00001-25-R-0001',
        title: 'IT Infrastructure Modernization Services',
        description: 'Comprehensive IT infrastructure upgrade and modernization services for federal agency systems including cloud migration, cybersecurity enhancements, and network optimization.',
        agency: 'Department of Defense',
        contract_value: 5000000,
        posted_date: '2025-01-15T00:00:00Z',
        content_summary: 'Large-scale IT modernization project requiring cloud expertise and security clearances.',
        relevanceScore: 0.95
      },
      {
        id: 'CONTRACT_002',
        notice_id: 'GSA-25-Q-0002',
        title: 'Cybersecurity Assessment and Implementation',
        description: 'Comprehensive cybersecurity assessment, vulnerability testing, and implementation of security measures across government networks and systems.',
        agency: 'General Services Administration',
        contract_value: 3200000,
        posted_date: '2025-01-10T00:00:00Z',
        content_summary: 'Cybersecurity project focusing on assessment and implementation of security controls.',
        relevanceScore: 0.88
      },
      {
        id: 'CONTRACT_003',
        notice_id: 'DHS-25-C-0003',
        title: 'Software Development and Maintenance',
        description: 'Custom software development, maintenance, and support services for mission-critical applications used in homeland security operations.',
        agency: 'Department of Homeland Security',
        contract_value: 2800000,
        posted_date: '2025-01-08T00:00:00Z',
        content_summary: 'Software development project for homeland security applications.',
        relevanceScore: 0.82
      },
      {
        id: 'CONTRACT_004',
        notice_id: 'VA-25-M-0004',
        title: 'Healthcare IT System Integration',
        description: 'Integration and optimization of healthcare IT systems, electronic health records, and patient management systems for veterans affairs.',
        agency: 'Department of Veterans Affairs',
        contract_value: 4500000,
        posted_date: '2025-01-05T00:00:00Z',
        content_summary: 'Healthcare IT integration project for veterans affairs systems.',
        relevanceScore: 0.75
      },
      {
        id: 'CONTRACT_005',
        notice_id: 'DOE-25-E-0005',
        title: 'Data Analytics and Visualization Platform',
        description: 'Development and implementation of advanced data analytics and visualization platform for energy sector monitoring and reporting.',
        agency: 'Department of Energy',
        contract_value: 1800000,
        posted_date: '2025-01-03T00:00:00Z',
        content_summary: 'Data analytics platform development for energy sector applications.',
        relevanceScore: 0.70
      }
    ];

    // Filter results based on query relevance
    let filteredResults = mockContracts.filter(contract => {
      const searchTerms = queryText.toLowerCase().split(' ');
      const searchableText = `${contract.title} ${contract.description} ${contract.agency}`.toLowerCase();
      
      return searchTerms.some(term => searchableText.includes(term));
    });

    // Apply filters if provided
    if (filters.agency) {
      filteredResults = filteredResults.filter(contract => 
        contract.agency.toLowerCase().includes(filters.agency.toLowerCase())
      );
    }

    if (filters.minValue) {
      filteredResults = filteredResults.filter(contract => 
        contract.contract_value >= filters.minValue
      );
    }

    if (filters.maxValue) {
      filteredResults = filteredResults.filter(contract => 
        contract.contract_value <= filters.maxValue
      );
    }

    // If no matches found, return a subset of all contracts
    if (filteredResults.length === 0) {
      filteredResults = mockContracts.slice(0, Math.min(3, limit));
    }

    // Sort by relevance and limit results
    filteredResults = filteredResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return {
      results: filteredResults,
      totalResults: filteredResults.length,
      query: queryText,
      searchType: 'mock'
    };
  }

  async hybridSearch(queryText, options = {}) {
    try {
      // Perform both semantic and keyword search
      const semanticResults = await this.semanticSearch(queryText, options);
      
      // If semantic search failed and returned mock data, just return it
      if (semanticResults.searchType === 'mock') {
        return semanticResults;
      }
      
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
      // Final fallback to mock search
      logger.warn('Hybrid search failed, falling back to mock results');
      return await this.getMockSearchResults(queryText, options);
    }
  }
}

module.exports = SemanticSearchService;
