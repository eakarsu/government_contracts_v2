const express = require('express');
const axios = require('axios');
const { query } = require('../config/database');
const VectorService = require('../services/vectorService');
const config = require('../config/env');

const router = express.Router();

// Initialize vector service
const vectorService = new VectorService();
vectorService.initialize().catch(console.error);

// Helper function to get contract from vector database (same as aiFeatures.js)
async function getContractFromVector(contractId) {
  try {
    // First try to get by exact ID
    let contract = await vectorService.getContractById(contractId);
    
    if (contract) {
      return contract;
    }
    
    console.log(`Contract not found by ID ${contractId}, searching by content...`);
    
    // Try searching by contract ID as text content first (most specific)
    const exactSearchResults = await vectorService.searchContracts(contractId, { limit: 5 });
    
    if (exactSearchResults && exactSearchResults.length > 0) {
      // Look for exact matches first
      const exactMatch = exactSearchResults.find(result => 
        result.description?.includes(contractId) || 
        result.title?.includes(contractId) ||
        result.noticeId === contractId ||
        result.id === contractId
      );
      
      if (exactMatch) {
        console.log(`Found exact match by content: ${exactMatch.title}`);
        return exactMatch;
      }
    }
    
    // If no exact match, try fuzzy search by extracting keywords from the contract ID
    const keywords = extractSearchKeywords(contractId);
    
    if (keywords.length > 0) {
      console.log(`Searching with extracted keywords: ${keywords.join(', ')}`);
      
      for (const keyword of keywords) {
        const keywordResults = await vectorService.searchContracts(keyword, { limit: 3 });
        
        if (keywordResults && keywordResults.length > 0) {
          // Find the best match that might be related
          const relatedMatch = keywordResults.find(result => 
            result.title?.toLowerCase().includes(keyword.toLowerCase()) ||
            result.description?.toLowerCase().includes(keyword.toLowerCase()) ||
            result.agency?.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (relatedMatch) {
            console.log(`Found related contract by keyword "${keyword}": ${relatedMatch.title}`);
            return relatedMatch;
          }
        }
      }
    }
    
    // Fallback to first result from exact search if available
    if (exactSearchResults && exactSearchResults.length > 0) {
      console.log(`Using fallback match: ${exactSearchResults[0].title}`);
      return exactSearchResults[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting contract from vector database:', error);
    return null;
  }
}

// Helper function to extract search keywords from contract ID
function extractSearchKeywords(contractId) {
  const keywords = [];
  
  // Extract alphanumeric segments
  const segments = contractId.split(/[-_\s]+/).filter(segment => segment.length > 2);
  keywords.push(...segments);
  
  // Extract agency codes (letters at start)
  const agencyMatch = contractId.match(/^([A-Z]+)/);
  if (agencyMatch) {
    keywords.push(agencyMatch[1]);
  }
  
  // Extract specific patterns
  if (contractId.includes('FA8232')) {
    keywords.push('F-16', 'databus', 'MIL-STD-1553', 'Air Force');
  } else if (contractId.includes('W9')) {
    keywords.push('Army', 'Corps of Engineers');
  } else if (contractId.includes('N0')) {
    keywords.push('Navy');
  } else if (contractId.includes('VA-')) {
    keywords.push('Veterans Affairs');
  }
  
  // Remove duplicates and short keywords
  return [...new Set(keywords)].filter(k => k.length > 2);
}

// Debug middleware for contracts router
router.use((req, res, next) => {
  console.log(`📋 [DEBUG] Contracts route hit: ${req.method} ${req.path}`);
  next();
});

// Get contracts with pagination
router.get('/', async (req, res) => {
  console.log('📋 [DEBUG] GET / route handler called');
  try {
    const { page = 1, limit = 20, search, agency, naicsCode } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause for filtering
    const where = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { agency: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (agency) {
      where.agency = { contains: agency, mode: 'insensitive' };
    }
    
    if (naicsCode) {
      where.naicsCode = naicsCode;
    }

    // Check if contracts table exists, if not return empty result
    let totalCount = 0;
    let contracts = [];

    try {
      // Get total count for pagination
      const totalResult = await query('SELECT COUNT(*) FROM contract');
      totalCount = parseInt(totalResult.rows[0].count);

      // Get contracts with pagination
      const result = await query(`
        SELECT 
          id, notice_id, title, description, agency, naics_code, 
          classification_code, posted_date, set_aside_code, 
          resource_links, indexed_at, created_at, updated_at,
          contract_value
        FROM contract 
        ORDER BY posted_date DESC NULLS LAST, created_at DESC
        LIMIT $1 OFFSET $2
      `, [parseInt(limit), offset]);

      contracts = result.rows.map(row => ({
        id: row.id,
        noticeId: row.notice_id,
        title: row.title,
        description: row.description,
        agency: row.agency,
        naicsCode: row.naics_code,
        classificationCode: row.classification_code,
        postedDate: row.posted_date,
        setAsideCode: row.set_aside_code,
        resourceLinks: (() => {
          if (!row.resource_links) return [];
          if (Array.isArray(row.resource_links)) return row.resource_links;
          if (typeof row.resource_links === 'string') {
            try {
              return JSON.parse(row.resource_links);
            } catch (e) {
              console.warn(`Invalid JSON in resource_links for contract ${row.notice_id}:`, row.resource_links);
              return [];
            }
          }
          return [];
        })(),
        indexedAt: row.indexed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        contractValue: row.contract_value
      }));
    } catch (dbError) {
      console.warn('Contracts table may not exist:', dbError.message);
      // Return empty result if table doesn't exist
      totalCount = 0;
      contracts = [];
    }

    res.json({
      success: true,
      contracts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Failed to fetch contracts:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch contracts',
      details: error.message 
    });
  }
});

// Get single contract by noticeId - VECTOR DATABASE ONLY
router.get('/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    if (!vectorService || !vectorService.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Vector database not available'
      });
    }
    
    // Get contract using smart search function
    const contract = await getContractFromVector(noticeId);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found in vector database'
      });
    }
    
    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract from vector DB:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract from vector database',
      details: error.message
    });
  }
});

// Helper function to format dates for SAM.gov API (MM/dd/yyyy format)
function formatDateForSAM(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Fetch contracts from SAM.gov API
router.post('/fetch', async (req, res) => {
  try {
    const { start_date, end_date, limit = 100, offset = 0 } = req.body;

    // Parse dates or use intelligent defaults
    let startDate = start_date ? new Date(start_date) : null;
    let endDate = end_date ? new Date(end_date) : null;

    // Auto-expand search range if no dates provided
    if (!startDate && !endDate) {
      const oldestContractResult = await query(`
        SELECT posted_date FROM contract 
        WHERE posted_date IS NOT NULL 
        ORDER BY posted_date ASC 
        LIMIT 1
      `);
      const oldestContract = oldestContractResult.rows[0];

      if (oldestContract?.posted_date) {
        startDate = new Date(oldestContract.posted_date);
        startDate.setDate(startDate.getDate() - 30);
        endDate = new Date(oldestContract.posted_date);
        endDate.setDate(endDate.getDate() - 1);
      } else {
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);
      }
    }

    // Create indexing job record
    const jobResult = await query(`
      INSERT INTO indexing_jobs (job_type, status, start_date, end_date, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, ['contracts', 'running', startDate, endDate]);
    
    const job = { id: jobResult.rows[0].id };

    try {
      // Fetch contracts from SAM.gov
      const samGovUrl = `https://api.sam.gov/opportunities/v2/search`;
      const params = new URLSearchParams({
        api_key: config.samGovApiKey,
        limit: Math.min(limit, 1000),
        offset,
        postedFrom: startDate ? formatDateForSAM(startDate) : undefined,
        postedTo: endDate ? formatDateForSAM(endDate) : undefined
      });

      const response = await axios.get(`${samGovUrl}?${params}`);
      const contractsData = response.data.opportunitiesData || [];
      
      let processedCount = 0;
      let errorsCount = 0;

      for (const contractData of contractsData) {
        try {
          const contractDetails = {
            noticeId: contractData.noticeId,
            title: contractData.title,
            description: contractData.description,
            agency: contractData.fullParentPathName,
            naicsCode: contractData.naicsCode,
            classificationCode: contractData.classificationCode,
            postedDate: contractData.postedDate ? new Date(contractData.postedDate) : null,
            setAsideCode: contractData.typeOfSetAsideCode,
            resourceLinks: contractData.resourceLinks || []
          };
          
          if (!contractDetails.noticeId) continue;

          // Upsert contract using raw SQL
          await query(`
            INSERT INTO contract (
              notice_id, title, description, agency, naics_code, 
              classification_code, posted_date, set_aside_code, resource_links,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT (notice_id) 
            DO UPDATE SET 
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              agency = EXCLUDED.agency,
              naics_code = EXCLUDED.naics_code,
              classification_code = EXCLUDED.classification_code,
              posted_date = EXCLUDED.posted_date,
              set_aside_code = EXCLUDED.set_aside_code,
              resource_links = EXCLUDED.resource_links,
              updated_at = NOW()
          `, [
            contractDetails.noticeId,
            contractDetails.title,
            contractDetails.description,
            contractDetails.agency,
            contractDetails.naicsCode,
            contractDetails.classificationCode,
            contractDetails.postedDate,
            contractDetails.setAsideCode,
            JSON.stringify(contractDetails.resourceLinks)
          ]);

          processedCount++;
        } catch (error) {
          console.error('Error processing contract:', error);
          errorsCount++;
        }
      }

      // Update job status
      await query(`
        UPDATE indexing_jobs 
        SET status = $1, records_processed = $2, errors_count = $3, completed_at = NOW()
        WHERE id = $4
      `, ['completed', processedCount, errorsCount, job.id]);

      res.json({
        success: true,
        job_id: job.id,
        contracts_processed: processedCount,
        errors: errorsCount,
        total_available: response.data.totalRecords || 0
      });

    } catch (error) {
      await query(`
        UPDATE indexing_jobs 
        SET status = $1, error_details = $2, completed_at = NOW()
        WHERE id = $3
      `, ['failed', error.message, job.id]);
      throw error;
    }

  } catch (error) {
    console.error('Contract fetch failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index contracts in vector database
router.post('/index', async (req, res) => {
  try {
    const { limit = 100 } = req.body;

    // Get the vector service from the global instance
    const vectorService = require('../server').vectorService;
    
    if (!vectorService || !vectorService.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Vector database not available'
      });
    }

    // Get contracts that haven't been indexed yet
    const result = await query(`
      SELECT * FROM contract 
      WHERE indexed_at IS NULL 
      LIMIT $1
    `, [limit]);
    
    const contracts = result.rows;

    if (contracts.length === 0) {
      const totalIndexed = await query(`
        SELECT COUNT(*) FROM contract WHERE indexed_at IS NOT NULL
      `);
      return res.json({
        message: `All contracts already indexed. Total: ${totalIndexed.rows[0].count}`,
        indexed_count: 0,
        total_indexed: parseInt(totalIndexed.rows[0].count)
      });
    }

    // Create indexing job
    const jobResult = await query(`
      INSERT INTO indexing_jobs (job_type, status, created_at)
      VALUES ($1, $2, NOW())
      RETURNING id
    `, ['contracts_indexing', 'running']);
    
    const job = { id: jobResult.rows[0].id };

    let indexedCount = 0;
    let errorsCount = 0;

    try {
      for (const contract of contracts) {
        try {
          // Transform snake_case to camelCase for vector service
          const transformedContract = {
            id: contract.id,
            noticeId: contract.notice_id,
            title: contract.title,
            description: contract.description,
            agency: contract.agency,
            naicsCode: contract.naics_code,
            classificationCode: contract.classification_code,
            postedDate: contract.posted_date,
            setAsideCode: contract.set_aside_code,
            resourceLinks: (() => {
              try {
                if (!contract.resource_links || contract.resource_links.trim() === '') {
                  return [];
                }
                return JSON.parse(contract.resource_links);
              } catch (jsonError) {
                console.warn(`Invalid JSON in resource_links for contract ${contract.notice_id}:`, contract.resource_links);
                return [];
              }
            })(),
            indexedAt: contract.indexed_at,
            createdAt: contract.created_at,
            updatedAt: contract.updated_at,
            contractValue: contract.contract_value
          };
          
          // Index contract in vector database
          await vectorService.indexContract(transformedContract);
          
          // Mark as indexed
          await query(`
            UPDATE contract 
            SET indexed_at = NOW() 
            WHERE id = $1
          `, [contract.id]);
          
          indexedCount++;
          
          // Commit changes periodically
          if (indexedCount % 10 === 0) {
            console.log(`Indexed ${indexedCount} contracts so far...`);
          }
        } catch (error) {
          console.error(`Error indexing contract ${contract.notice_id}:`, error.message);
          console.error(`Contract data:`, {
            id: contract.id,
            notice_id: contract.notice_id,
            title: contract.title?.substring(0, 50) + '...',
            resource_links_length: contract.resource_links?.length || 0
          });
          errorsCount++;
        }
      }

      // Update job status
      await query(`
        UPDATE indexing_jobs 
        SET status = $1, records_processed = $2, errors_count = $3, completed_at = NOW()
        WHERE id = $4
      `, ['completed', indexedCount, errorsCount, job.id]);

      res.json({
        success: true,
        job_id: job.id,
        indexed_count: indexedCount,
        errors_count: errorsCount
      });

    } catch (error) {
      await query(`
        UPDATE indexing_jobs 
        SET status = $1, error_details = $2, completed_at = NOW()
        WHERE id = $3
      `, ['failed', error.message, job.id]);
      throw error;
    }

  } catch (error) {
    console.error('Contract indexing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search contracts endpoint
router.post('/search', async (req, res) => {
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
        // Get the vector service from the global instance
        const vectorService = require('../server').vectorService;
        const vectorResults = await vectorService.searchContracts(query, limit);
        
        // Get full contract details from database
        const contractIds = vectorResults.map(r => r.id);
        if (contractIds.length > 0) {
          const placeholders = contractIds.map((_, i) => `$${i + 1}`).join(',');
          const searchResult = await query(`
            SELECT * FROM contract 
            WHERE notice_id IN (${placeholders})
            ORDER BY posted_date DESC NULLS LAST, created_at DESC
          `, contractIds);
          
          contracts = searchResult.rows.map(row => ({
            id: row.id,
            noticeId: row.notice_id,
            title: row.title,
            description: row.description,
            agency: row.agency,
            naicsCode: row.naics_code,
            classificationCode: row.classification_code,
            postedDate: row.posted_date,
            setAsideCode: row.set_aside_code,
            resourceLinks: (() => {
          if (!row.resource_links) return [];
          if (Array.isArray(row.resource_links)) return row.resource_links;
          if (typeof row.resource_links === 'string') {
            try {
              return JSON.parse(row.resource_links);
            } catch (e) {
              console.warn(`Invalid JSON in resource_links for contract ${row.notice_id}:`, row.resource_links);
              return [];
            }
          }
          return [];
        })(),
            indexedAt: row.indexed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
        }

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
      const searchResult = await query(`
        SELECT * FROM contract 
        WHERE title ILIKE $1 OR description ILIKE $1 OR agency ILIKE $1
        ORDER BY posted_date DESC NULLS LAST, created_at DESC
        LIMIT $2
      `, [`%${query}%`, Math.min(limit, 50)]);
      
      contracts = searchResult.rows.map(row => ({
        id: row.id,
        noticeId: row.notice_id,
        title: row.title,
        description: row.description,
        agency: row.agency,
        naicsCode: row.naics_code,
        classificationCode: row.classification_code,
        postedDate: row.posted_date,
        setAsideCode: row.set_aside_code,
        resourceLinks: (() => {
          if (!row.resource_links) return [];
          if (Array.isArray(row.resource_links)) return row.resource_links;
          if (typeof row.resource_links === 'string') {
            try {
              return JSON.parse(row.resource_links);
            } catch (e) {
              console.warn(`Invalid JSON in resource_links for contract ${row.notice_id}:`, row.resource_links);
              return [];
            }
          }
          return [];
        })(),
        indexedAt: row.indexed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }

    const responseTime = (Date.now() - startTime) / 1000;

    // Log search query
    await query(`
      INSERT INTO search_queries (query_text, results_count, response_time, user_ip, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [query, contracts.length, responseTime, req.ip]);

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

// Analyze specific contract with AI
router.post('/:noticeId/analyze', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    const contractResult = await query(
      'SELECT * FROM contract WHERE notice_id = $1',
      [noticeId]
    );
    const contract = contractResult.rows[0];

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Simple AI analysis (placeholder)
    const analysis = {
      summary: `Analysis for contract ${contract.title}`,
      key_points: [
        'Contract opportunity identified',
        'Agency: ' + (contract.agency || 'Unknown'),
        'NAICS Code: ' + (contract.naicsCode || 'Not specified')
      ],
      recommendations: [
        'Review contract requirements carefully',
        'Prepare competitive proposal',
        'Consider partnership opportunities'
      ]
    };

    res.json({
      contract_id: noticeId,
      analysis
    });

  } catch (error) {
    console.error('Contract analysis failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
