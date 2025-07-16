const express = require('express');
const axios = require('axios');
const { query } = require('../config/database');
const VectorService = require('../services/vectorService');
const config = require('../config/env');

const router = express.Router();

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
      const totalResult = await query('SELECT COUNT(*) FROM contracts');
      totalCount = parseInt(totalResult.rows[0].count);

      // Get contracts with pagination
      const result = await query(`
        SELECT 
          id, notice_id, title, description, agency, naics_code, 
          classification_code, posted_date, set_aside_code, 
          resource_links, indexed_at, created_at, updated_at,
          contract_value
        FROM contracts 
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
        resourceLinks: row.resource_links ? JSON.parse(row.resource_links) : [],
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
    
    // Get the vector service from the global instance
    const vectorService = require('../server').vectorService;
    
    if (!vectorService || !vectorService.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Vector database not available'
      });
    }
    
    // Get contract directly from vector database by ID
    const contract = await vectorService.getContractById(noticeId);
    
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
        SELECT posted_date FROM contracts 
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
            INSERT INTO contracts (
              notice_id, title, description, agency, naics_code, 
              classification_code, posted_date, set_aside_code, resource_links
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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

    // Get contracts that haven't been indexed yet
    const result = await query(`
      SELECT * FROM contracts 
      WHERE indexed_at IS NULL 
      LIMIT $1
    `, [limit]);
    
    const contracts = result.rows;

    if (contracts.length === 0) {
      const totalIndexed = await prisma.contract.count({
        where: { indexedAt: { not: null } }
      });
      return res.json({
        message: `All contracts already indexed. Total: ${totalIndexed}`,
        indexed_count: 0,
        total_indexed: totalIndexed
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
          // Index contract in vector database
          await vectorService.indexContract(contract);
          
          // Mark as indexed
          await query(`
            UPDATE contracts 
            SET indexed_at = NOW() 
            WHERE id = $1
          `, [contract.id]);
          
          indexedCount++;
          
          // Commit changes periodically
          if (indexedCount % 10 === 0) {
            console.log(`Indexed ${indexedCount} contracts so far...`);
          }
        } catch (error) {
          console.error(`Error indexing contract ${contract.notice_id}:`, error);
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
      const searchResult = await query(`
        SELECT * FROM contracts 
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
        resourceLinks: row.resource_links ? JSON.parse(row.resource_links) : [],
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
      'SELECT * FROM contracts WHERE notice_id = $1',
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
