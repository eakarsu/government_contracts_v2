const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const { query } = require('../config/database');
const VectorService = require('../services/vectorService');
const config = require('../config/env');

const router = express.Router();

// Debug endpoint to test vector service status and duplicate detection
router.get('/debug/vector-status', async (req, res) => {
  try {
    const noticeId = req.query.noticeId || 'd60c3f21b07d4fb4bc8114383a9ea568';
    
    const status = {
      vectorServiceReady,
      isConnected: vectorService.isConnected,
      contractsIndexExists: !!vectorService.contractsIndex
    };
    
    // Test findExactContract
    const existingContract = await vectorService.findExactContract(noticeId);
    
    status.findExactContractResult = {
      found: existingContract !== null,
      contractData: existingContract ? {
        id: existingContract.metadata?.id,
        title: existingContract.metadata?.title
      } : null
    };
    
    // Get collection stats
    const stats = await vectorService.getCollectionStats();
    status.collectionStats = stats;
    
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Initialize vector service
const vectorService = new VectorService();
let vectorServiceReady = false;

// Initialize and track readiness
vectorService.initialize()
  .then(() => {
    vectorServiceReady = true;
    console.log('✅ Vector service initialized and ready');
  })
  .catch(error => {
    console.error('❌ Vector service initialization failed:', error);
    vectorServiceReady = false;
  });

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

// Helper function to fetch full description from SAM.gov API
async function fetchFullDescription(noticeId) {
  try {
    const descUrl = `https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=${noticeId}&api_key=${config.samGovApiKey}`;
    console.log(`📄 Fetching full description for contract ${noticeId}`);

    const response = await axios.get(descUrl, { timeout: 10000 });

    // SAM.gov returns HTML content in the description
    if (response.data && response.data.description) {
      return response.data.description;
    }

    // Some responses return it in a different format
    if (typeof response.data === 'string') {
      return response.data;
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch description for ${noticeId}:`, error.message);
    return null;
  }
}

// Get single contract by noticeId - PostgreSQL first, then Vector DB
router.get('/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;

    // First try to get from PostgreSQL (has full descriptions)
    let contract = null;
    try {
      const dbResult = await query(`
        SELECT
          notice_id, title, description, agency, naics_code,
          classification_code, posted_date, set_aside_code, resource_links,
          indexed_at, created_at, updated_at, contract_value
        FROM contract
        WHERE notice_id = $1
      `, [noticeId]);

      if (dbResult.rows.length > 0) {
        const row = dbResult.rows[0];
        contract = {
          id: row.notice_id,
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
                return [];
              }
            }
            return [];
          })(),
          indexedAt: row.indexed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          contractValue: row.contract_value,
          source: 'postgresql'
        };
        console.log(`📋 Contract ${noticeId} loaded from PostgreSQL (${(contract.description || '').length} char description)`);
      }
    } catch (dbError) {
      console.warn(`⚠️ PostgreSQL lookup failed for ${noticeId}:`, dbError.message);
    }

    // Fall back to vector database if not found in PostgreSQL
    if (!contract) {
      if (!vectorService || !vectorService.isConnected) {
        return res.status(503).json({
          success: false,
          error: 'Database not available'
        });
      }

      contract = await getContractFromVector(noticeId);
      if (contract) {
        contract.source = 'vector';
        console.log(`📋 Contract ${noticeId} loaded from Vector DB`);
      }
    }

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }

    // Check if description is incomplete (URL-only or too short)
    const description = contract.description || '';
    const isSamGovUrl = description.includes('api.sam.gov') && description.includes('noticedesc');
    const isIncomplete = isSamGovUrl || !description || description.length < 100;

    if (isIncomplete) {
      // Mark as incomplete and provide SAM.gov URL instead of fetching
      contract.descriptionIncomplete = true;
      contract.samGovUrl = `https://sam.gov/opp/${noticeId}/view`;
      contract.description = null; // Clear the URL-only description
    }

    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract',
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

      console.log(`📋 Processing ${contractsData.length} contracts, fetching full descriptions...`);

      for (const contractData of contractsData) {
        try {
          if (!contractData.noticeId) continue;

          // Fetch full description from SAM.gov noticedesc API
          let fullDescription = contractData.description || '';
          try {
            const descResponse = await fetchFullDescription(contractData.noticeId);
            if (descResponse) {
              fullDescription = descResponse;
              console.log(`📄 [${processedCount + 1}/${contractsData.length}] Fetched description for ${contractData.noticeId} (${fullDescription.length} chars)`);
            }
          } catch (descError) {
            console.warn(`⚠️ Could not fetch description for ${contractData.noticeId}:`, descError.message);
          }

          const contractDetails = {
            noticeId: contractData.noticeId,
            title: contractData.title,
            description: fullDescription,
            agency: contractData.fullParentPathName,
            naicsCode: contractData.naicsCode,
            classificationCode: contractData.classificationCode,
            postedDate: contractData.postedDate ? new Date(contractData.postedDate) : null,
            setAsideCode: contractData.typeOfSetAsideCode,
            resourceLinks: Array.isArray(contractData.resourceLinks) ? contractData.resourceLinks : []
          };

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
            JSON.stringify(contractDetails.resourceLinks || [])
          ]);

          // Auto-download and queue attachments for processing
          if (contractDetails.resourceLinks && contractDetails.resourceLinks.length > 0) {
            console.log(`📎 [${contractDetails.noticeId}] Queueing ${contractDetails.resourceLinks.length} attachments for download`);

            // Queue attachments in background (don't block the main fetch)
            setImmediate(async () => {
              try {
                for (const resourceUrl of contractDetails.resourceLinks.slice(0, 10)) { // Limit to 10 attachments per contract
                  if (typeof resourceUrl === 'string' && resourceUrl.includes('sam.gov')) {
                    // Download the file
                    const downloadPath = path.join(process.cwd(), 'downloaded_documents');
                    await fs.ensureDir(downloadPath);

                    const filename = `${contractDetails.noticeId}_download_${Date.now()}${path.extname(resourceUrl) || '.pdf'}`;
                    const filePath = path.join(downloadPath, filename);

                    try {
                      const response = await axios.get(resourceUrl, {
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)' }
                      });

                      await fs.writeFile(filePath, response.data);
                      console.log(`📥 Downloaded: ${filename} (${(response.data.length / 1024).toFixed(1)} KB)`);
                    } catch (dlError) {
                      console.warn(`⚠️ Failed to download ${resourceUrl}:`, dlError.message);
                    }
                  }
                }
              } catch (bgError) {
                console.error(`❌ Background download error for ${contractDetails.noticeId}:`, bgError.message);
              }
            });
          }

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
                if (!contract.resource_links) {
                  return [];
                }
                
                // If it's already an array, return it directly
                if (Array.isArray(contract.resource_links)) {
                  console.log(`📄 [DEBUG] Resource links already an array for contract ${contract.notice_id}:`, contract.resource_links);
                  return contract.resource_links;
                }
                
                // If it's a string, try to parse it
                if (typeof contract.resource_links === 'string') {
                  if (contract.resource_links.trim() === '') {
                    return [];
                  }
                  
                  // Try parsing as JSON first
                  try {
                    return JSON.parse(contract.resource_links);
                  } catch (jsonError) {
                    // If JSON parsing fails, try to fix single quotes to double quotes
                    const fixedJson = contract.resource_links.replace(/'/g, '"');
                    console.log(`📄 [DEBUG] Fixing single quotes to double quotes for contract ${contract.notice_id}`);
                    return JSON.parse(fixedJson);
                  }
                }
                
                return [];
              } catch (parseError) {
                console.warn(`Unable to parse resource_links for contract ${contract.notice_id}:`, contract.resource_links);
                console.warn(`Parse error:`, parseError.message);
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

// Fetch specific contract by Notice ID from SAM.gov
router.post('/fetch/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    if (!noticeId) {
      return res.status(400).json({ error: 'Notice ID is required' });
    }

    console.log(`Fetching specific contract: ${noticeId}`);

    // Create indexing job record
    const jobResult = await query(`
      INSERT INTO indexing_jobs (job_type, status, created_at)
      VALUES ($1, $2, NOW())
      RETURNING id
    `, ['single_contract', 'running']);
    
    const job = { id: jobResult.rows[0].id };

    try {
      // Try to fetch from SAM.gov API using the notice ID
      const samGovUrl = `https://api.sam.gov/opportunities/v2/search`;
      const params = new URLSearchParams({
        api_key: config.samGovApiKey,
        limit: 100,
        offset: 0
      });
      
      // Add notice ID as search query
      params.append('q', noticeId);
      
      // SAM.gov requires PostedFrom and PostedTo - use wide date range for single contract search
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2); // Search last 2 years
      
      params.append('postedFrom', formatDateForSAM(startDate));
      params.append('postedTo', formatDateForSAM(endDate));
      
      // Remove undefined values
      for (const [key, value] of params.entries()) {
        if (value === 'undefined' || value === undefined) {
          params.delete(key);
        }
      }

      console.log(`Searching SAM.gov for: ${noticeId}`);
      const response = await axios.get(`${samGovUrl}?${params}`);
      const contractsData = response.data.opportunitiesData || [];
      
      // Look for exact match by notice ID
      const targetContract = contractsData.find(contract => 
        contract.noticeId === noticeId ||
        contract.solicitationNumber === noticeId
      );

      if (!targetContract) {
        await query(`
          UPDATE indexing_jobs 
          SET status = $1, error_details = $2, completed_at = NOW()
          WHERE id = $3
        `, ['failed', `Contract ${noticeId} not found in SAM.gov API`, job.id]);
        
        return res.status(404).json({ 
          success: false,
          error: `Contract ${noticeId} not found in SAM.gov API`,
          searched_results: contractsData.length,
          job_id: job.id
        });
      }

      // Process the found contract
      const contractDetails = {
        noticeId: targetContract.noticeId,
        title: targetContract.title,
        description: targetContract.description,
        agency: targetContract.fullParentPathName,
        naicsCode: targetContract.naicsCode,
        classificationCode: targetContract.classificationCode,
        postedDate: targetContract.postedDate ? new Date(targetContract.postedDate) : null,
        setAsideCode: targetContract.typeOfSetAsideCode,
        resourceLinks: Array.isArray(targetContract.resourceLinks) ? targetContract.resourceLinks : []
      };

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
        JSON.stringify(contractDetails.resourceLinks || [])
      ]);

      // Update job status
      await query(`
        UPDATE indexing_jobs 
        SET status = $1, records_processed = $2, completed_at = NOW()
        WHERE id = $3
      `, ['completed', 1, job.id]);

      res.json({
        success: true,
        job_id: job.id,
        contract: contractDetails,
        message: `Contract ${noticeId} fetched and saved successfully`
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
    console.error('Single contract fetch failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Failed to fetch specific contract from SAM.gov'
    });
  }
});

// Index specific contract by Notice ID in vector database
router.post('/index/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    if (!noticeId) {
      return res.status(400).json({ error: 'Notice ID is required' });
    }

    // Get the vector service from the global instance
    const vectorService = require('../server').vectorService;
    
    if (!vectorService || !vectorService.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Vector database not available'
      });
    }

    // Get the specific contract from database
    const result = await query(`
      SELECT * FROM contract 
      WHERE notice_id = $1
    `, [noticeId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Contract ${noticeId} not found in database. Fetch it first using POST /api/contracts/fetch/${noticeId}`
      });
    }

    const contract = result.rows[0];

    // Create indexing job
    const jobResult = await query(`
      INSERT INTO indexing_jobs (job_type, status, created_at)
      VALUES ($1, $2, NOW())
      RETURNING id
    `, ['single_contract_indexing', 'running']);
    
    const job = { id: jobResult.rows[0].id };

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
            if (!contract.resource_links) {
              return [];
            }
            
            // If it's already an array, return it directly
            if (Array.isArray(contract.resource_links)) {
              console.log(`📄 [DEBUG] Resource links already an array for contract ${contract.notice_id}:`, contract.resource_links);
              return contract.resource_links;
            }
            
            // If it's a string, try to parse it
            if (typeof contract.resource_links === 'string') {
              if (contract.resource_links.trim() === '') {
                return [];
              }
              
              // Try parsing as JSON first
              try {
                return JSON.parse(contract.resource_links);
              } catch (jsonError) {
                // If JSON parsing fails, try to fix single quotes to double quotes
                const fixedJson = contract.resource_links.replace(/'/g, '"');
                console.log(`📄 [DEBUG] Fixing single quotes to double quotes for contract ${contract.notice_id}`);
                return JSON.parse(fixedJson);
              }
            }
            
            return [];
          } catch (parseError) {
            console.warn(`Unable to parse resource_links for contract ${contract.notice_id}:`, contract.resource_links);
            console.warn(`Parse error:`, parseError.message);
            return [];
          }
        })(),
        indexedAt: contract.indexed_at,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
        contractValue: contract.contract_value
      };
      
      // Ensure vector service is initialized before checking for duplicates
      if (!vectorService.isConnected) {
        console.log('🔄 [INIT] Vector service not connected, initializing...');
        await vectorService.initialize();
      }
      
      // Check if contract is already indexed in vector database to prevent duplicates
      const existingContract = await vectorService.findExactContract(noticeId);
      const alreadyIndexed = existingContract !== null;
      
      if (alreadyIndexed) {
        console.log(`📄 [SKIP] Contract already indexed in vector database: ${noticeId}`);
        
        // Return early for already indexed contracts
        await query(`
          UPDATE contract 
          SET indexed_at = NOW() 
          WHERE notice_id = $1
        `, [noticeId]);

        return res.json({
          success: true,
          message: `Contract ${noticeId} already indexed in vector database (duplicate skipped)`,
          contract_id: noticeId,
          job_id: Date.now(),
          documents_processed: 0,
          duplicate_skipped: true
        });
      } else {
        // Index contract in vector database
        await vectorService.indexContract(transformedContract);
        console.log(`✅ [INDEXED] Contract added to vector database: ${noticeId}`);
      }
      
      // Process resourceLinks documents using standalone script to avoid blocking
      let documentsProcessed = 0;
      if (transformedContract.resourceLinks && transformedContract.resourceLinks.length > 0) {
        console.log(`📄 [PROCESS] Found ${transformedContract.resourceLinks.length} documents to process for contract ${noticeId}`);
        
        // Spawn child process to handle document processing without blocking server
        const { spawn } = require('child_process');
        const scriptPath = path.join(__dirname, '..', 'scripts', 'process-contract-documents.js');
        
        const child = spawn('node', [
          scriptPath,
          noticeId,
          JSON.stringify(transformedContract.resourceLinks)
        ], { 
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // Log child process output
        child.stdout.on('data', (data) => {
          console.log(`📄 [CHILD-${noticeId}] ${data.toString().trim()}`);
        });
        
        child.stderr.on('data', (data) => {
          console.error(`📄 [CHILD-${noticeId}] ERROR: ${data.toString().trim()}`);
        });
        
        child.unref(); // Allow parent process to exit independently
        
        console.log(`🚀 [PROCESS] Started background document processing for contract ${noticeId}`);
        documentsProcessed = transformedContract.resourceLinks.length;
      }
      
      // Mark as indexed
      await query(`
        UPDATE contract 
        SET indexed_at = NOW() 
        WHERE notice_id = $1
      `, [noticeId]);

      // Update job status
      await query(`
        UPDATE indexing_jobs 
        SET status = $1, records_processed = $2, completed_at = NOW()
        WHERE id = $3
      `, ['completed', 1, job.id]);

      res.json({
        success: true,
        job_id: job.id,
        contract_id: noticeId,
        documents_processed: documentsProcessed,
        message: `Contract ${noticeId} indexed successfully in vector database${documentsProcessed > 0 ? ` with ${documentsProcessed} documents processing in background` : ''}`
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
    console.error('Single contract indexing failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Failed to index specific contract in vector database'
    });
  }
});

// Fetch contracts by multiple search criteria from SAM.gov
router.post('/fetch-by-criteria', async (req, res) => {
  try {
    const { 
      noticeId, 
      title, 
      agency, 
      naicsCode, 
      keywords, 
      classificationCode,
      setAsideCode,
      postedFrom,
      postedTo,
      limit = 100
    } = req.body;

    if (!noticeId && !title && !agency && !naicsCode && !keywords && !classificationCode) {
      return res.status(400).json({ 
        error: 'At least one search criteria is required',
        supported_fields: ['noticeId', 'title', 'agency', 'naicsCode', 'keywords', 'classificationCode', 'setAsideCode', 'postedFrom', 'postedTo']
      });
    }

    console.log('Fetching contracts by criteria:', req.body);

    // Create indexing job record
    const jobResult = await query(`
      INSERT INTO indexing_jobs (job_type, status, created_at)
      VALUES ($1, $2, NOW())
      RETURNING id
    `, ['criteria_search', 'running']);
    
    const job = { id: jobResult.rows[0].id };

    try {
      // Build SAM.gov API parameters (matching working /fetch endpoint)
      const samGovUrl = `https://api.sam.gov/opportunities/v2/search`;
      const params = new URLSearchParams({
        api_key: config.samGovApiKey,
        limit: Math.min(limit, 1000),
        offset: 0
      });

      // Add search parameters based on what's provided
      // Use the same parameter names as the working /fetch endpoint
      if (noticeId || keywords) {
        // Combine notice ID and keywords into a single search query
        const searchTerms = [noticeId, keywords].filter(Boolean).join(' ');
        params.append('q', searchTerms);
      }
      
      // Add title search if provided
      if (title) {
        params.append('title', title);
      }
      
      // Use correct SAM.gov parameter names
      if (naicsCode) params.append('naics', naicsCode);
      if (classificationCode) params.append('psc', classificationCode);
      
      // SAM.gov requires PostedFrom and PostedTo - use defaults if not provided
      let startDate, endDate;
      
      if (postedFrom && postedTo) {
        startDate = new Date(postedFrom);
        endDate = new Date(postedTo);
      } else {
        // Use default date range: last 60 days to today
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);
      }
      
      params.append('postedFrom', formatDateForSAM(startDate));
      params.append('postedTo', formatDateForSAM(endDate));
      
      // Remove undefined values
      for (const [key, value] of params.entries()) {
        if (value === 'undefined' || value === undefined) {
          params.delete(key);
        }
      }

      console.log(`Searching SAM.gov with criteria:`, Object.fromEntries(params));
      const response = await axios.get(`${samGovUrl}?${params}`);
      const contractsData = response.data.opportunitiesData || [];
      
      if (contractsData.length === 0) {
        await query(`
          UPDATE indexing_jobs 
          SET status = $1, records_processed = $2, completed_at = NOW()
          WHERE id = $3
        `, ['completed', 0, job.id]);
        
        return res.json({ 
          success: true,
          job_id: job.id,
          contracts_found: 0,
          contracts_processed: 0,
          message: 'No contracts found matching the criteria',
          search_params: Object.fromEntries(params)
        });
      }

      // Process all found contracts
      let processedCount = 0;
      let errorsCount = 0;
      const processedContracts = [];

      console.log(`📋 Processing ${contractsData.length} contracts by criteria, fetching full descriptions...`);

      for (const contractData of contractsData) {
        try {
          if (!contractData.noticeId) continue;

          // Fetch full description from SAM.gov noticedesc API
          let fullDescription = contractData.description || '';
          try {
            const descResponse = await fetchFullDescription(contractData.noticeId);
            if (descResponse) {
              fullDescription = descResponse;
              console.log(`📄 [${processedCount + 1}/${contractsData.length}] Fetched description for ${contractData.noticeId} (${fullDescription.length} chars)`);
            }
          } catch (descError) {
            console.warn(`⚠️ Could not fetch description for ${contractData.noticeId}:`, descError.message);
          }

          const contractDetails = {
            noticeId: contractData.noticeId,
            title: contractData.title,
            description: fullDescription,
            agency: contractData.fullParentPathName,
            naicsCode: contractData.naicsCode,
            classificationCode: contractData.classificationCode,
            postedDate: contractData.postedDate ? new Date(contractData.postedDate) : null,
            setAsideCode: contractData.typeOfSetAsideCode,
            resourceLinks: Array.isArray(contractData.resourceLinks) ? contractData.resourceLinks : []
          };

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
            JSON.stringify(contractDetails.resourceLinks || [])
          ]);

          // Auto-download and queue attachments for processing
          if (contractDetails.resourceLinks && contractDetails.resourceLinks.length > 0) {
            console.log(`📎 [${contractDetails.noticeId}] Queueing ${contractDetails.resourceLinks.length} attachments for download`);

            setImmediate(async () => {
              try {
                for (const resourceUrl of contractDetails.resourceLinks.slice(0, 10)) {
                  if (typeof resourceUrl === 'string' && resourceUrl.includes('sam.gov')) {
                    const downloadPath = path.join(process.cwd(), 'downloaded_documents');
                    await fs.ensureDir(downloadPath);

                    const filename = `${contractDetails.noticeId}_download_${Date.now()}${path.extname(resourceUrl) || '.pdf'}`;
                    const filePath = path.join(downloadPath, filename);

                    try {
                      const response = await axios.get(resourceUrl, {
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)' }
                      });

                      await fs.writeFile(filePath, response.data);
                      console.log(`📥 Downloaded: ${filename} (${(response.data.length / 1024).toFixed(1)} KB)`);
                    } catch (dlError) {
                      console.warn(`⚠️ Failed to download ${resourceUrl}:`, dlError.message);
                    }
                  }
                }
              } catch (bgError) {
                console.error(`❌ Background download error for ${contractDetails.noticeId}:`, bgError.message);
              }
            });
          }

          processedContracts.push({
            noticeId: contractDetails.noticeId,
            title: contractDetails.title,
            agency: contractDetails.agency
          });
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
        contracts_found: contractsData.length,
        contracts_processed: processedCount,
        errors_count: errorsCount,
        search_criteria: req.body,
        processed_contracts: processedContracts.slice(0, 10), // Show first 10
        message: `Successfully fetched ${processedCount} contracts matching criteria`
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
    console.error('Criteria-based contract fetch failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Failed to fetch contracts by criteria from SAM.gov'
    });
  }
});

// Index contracts by search criteria (for contracts already in database)
router.post('/index-by-criteria', async (req, res) => {
  try {
    const { 
      noticeId, 
      title, 
      agency, 
      naicsCode, 
      keywords,
      limit = 100
    } = req.body;

    if (!noticeId && !title && !agency && !naicsCode && !keywords) {
      return res.status(400).json({ 
        error: 'At least one search criteria is required',
        supported_fields: ['noticeId', 'title', 'agency', 'naicsCode', 'keywords']
      });
    }

    // Get the vector service from the global instance
    const vectorService = require('../server').vectorService;
    
    if (!vectorService || !vectorService.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Vector database not available'
      });
    }

    // Build database query based on criteria
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (noticeId) {
      whereConditions.push(`notice_id ILIKE $${paramIndex}`);
      queryParams.push(`%${noticeId}%`);
      paramIndex++;
    }

    if (title) {
      whereConditions.push(`title ILIKE $${paramIndex}`);
      queryParams.push(`%${title}%`);
      paramIndex++;
    }

    if (agency) {
      whereConditions.push(`agency ILIKE $${paramIndex}`);
      queryParams.push(`%${agency}%`);
      paramIndex++;
    }

    if (naicsCode) {
      whereConditions.push(`naics_code = $${paramIndex}`);
      queryParams.push(naicsCode);
      paramIndex++;
    }

    if (keywords) {
      whereConditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex + 1})`);
      queryParams.push(`%${keywords}%`, `%${keywords}%`);
      paramIndex += 2;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    queryParams.push(limit);

    // Get matching contracts from database
    const result = await query(`
      SELECT * FROM contract 
      ${whereClause}
      ORDER BY posted_date DESC NULLS LAST, created_at DESC
      LIMIT $${paramIndex}
    `, queryParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No contracts found matching the criteria in database',
        search_criteria: req.body,
        suggestion: 'Try using POST /api/contracts/fetch-by-criteria first to fetch from SAM.gov'
      });
    }

    // Create indexing job
    const jobResult = await query(`
      INSERT INTO indexing_jobs (job_type, status, created_at)
      VALUES ($1, $2, NOW())
      RETURNING id
    `, ['criteria_indexing', 'running']);
    
    const job = { id: jobResult.rows[0].id };

    let indexedCount = 0;
    let errorsCount = 0;
    const indexedContracts = [];

    try {
      for (const contract of result.rows) {
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
                if (!contract.resource_links) {
                  return [];
                }
                
                // If it's already an array, return it directly
                if (Array.isArray(contract.resource_links)) {
                  console.log(`📄 [DEBUG] Resource links already an array for contract ${contract.notice_id}:`, contract.resource_links);
                  return contract.resource_links;
                }
                
                // If it's a string, try to parse it
                if (typeof contract.resource_links === 'string') {
                  if (contract.resource_links.trim() === '') {
                    return [];
                  }
                  
                  // Try parsing as JSON first
                  try {
                    return JSON.parse(contract.resource_links);
                  } catch (jsonError) {
                    // If JSON parsing fails, try to fix single quotes to double quotes
                    const fixedJson = contract.resource_links.replace(/'/g, '"');
                    console.log(`📄 [DEBUG] Fixing single quotes to double quotes for contract ${contract.notice_id}`);
                    return JSON.parse(fixedJson);
                  }
                }
                
                return [];
              } catch (parseError) {
                console.warn(`Unable to parse resource_links for contract ${contract.notice_id}:`, contract.resource_links);
                console.warn(`Parse error:`, parseError.message);
                return [];
              }
            })(),
            indexedAt: contract.indexed_at,
            createdAt: contract.created_at,
            updatedAt: contract.updated_at,
            contractValue: contract.contract_value
          };
          
          // Ensure vector service is initialized before checking for duplicates
          if (!vectorService.isConnected) {
            console.log('🔄 [INIT] Vector service not connected, initializing...');
            await vectorService.initialize();
          }
          
          // Check if contract is already indexed in vector database to prevent duplicates
          const existingContract = await vectorService.findExactContract(contract.notice_id);
          const alreadyIndexed = existingContract !== null;
          
          if (alreadyIndexed) {
            console.log(`📄 [SKIP] Contract already indexed in vector database: ${contract.notice_id}`);
          } else {
            // Index contract in vector database
            await vectorService.indexContract(transformedContract);
            console.log(`✅ [INDEXED] Contract added to vector database: ${contract.notice_id}`);
          }
          
          // Process resourceLinks documents using standalone script to avoid blocking
          let documentsProcessed = 0;
          if (transformedContract.resourceLinks && transformedContract.resourceLinks.length > 0) {
            console.log(`📄 [PROCESS] Found ${transformedContract.resourceLinks.length} documents to process for contract ${contract.notice_id}`);
            
            // Spawn child process to handle document processing without blocking server
            const { spawn } = require('child_process');
            const scriptPath = path.join(__dirname, '..', 'scripts', 'process-contract-documents.js');
            
            const child = spawn('node', [
              scriptPath,
              contract.notice_id,
              JSON.stringify(transformedContract.resourceLinks)
            ], { 
              detached: true,
              stdio: ['ignore', 'pipe', 'pipe']
            });
            
            // Log child process output
            child.stdout.on('data', (data) => {
              console.log(`📄 [CHILD-${contract.notice_id}] ${data.toString().trim()}`);
            });
            
            child.stderr.on('data', (data) => {
              console.error(`📄 [CHILD-${contract.notice_id}] ERROR: ${data.toString().trim()}`);
            });
            
            child.unref(); // Allow parent process to exit independently
            
            console.log(`🚀 [PROCESS] Started background document processing for contract ${contract.notice_id}`);
            documentsProcessed = transformedContract.resourceLinks.length;
          }
          
          // Mark contract as indexed
          await query(`
            UPDATE contract 
            SET indexed_at = NOW() 
            WHERE notice_id = $1
          `, [contract.notice_id]);
          
          indexedContracts.push({
            noticeId: contract.notice_id,
            title: contract.title,
            agency: contract.agency,
            documentsProcessed: documentsProcessed
          });
          indexedCount++;
        } catch (error) {
          console.error(`Error indexing contract ${contract.notice_id}:`, error.message);
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
        contracts_found: result.rows.length,
        contracts_indexed: indexedCount,
        errors_count: errorsCount,
        search_criteria: req.body,
        indexed_contracts: indexedContracts.slice(0, 10), // Show first 10
        message: `Successfully indexed ${indexedCount} contracts matching criteria. Document processing is running in background.`
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
    console.error('Criteria-based indexing failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Failed to index contracts by criteria'
    });
  }
});

// Separate endpoint for document processing (non-blocking)
router.post('/process-documents/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    // Get contract with resourceLinks
    const result = await query(`SELECT * FROM contract WHERE notice_id = $1`, [noticeId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    const contract = result.rows[0];
    
    // Parse resourceLinks
    let resourceLinks = [];
    try {
      if (Array.isArray(contract.resource_links)) {
        resourceLinks = contract.resource_links;
      } else if (typeof contract.resource_links === 'string') {
        resourceLinks = JSON.parse(contract.resource_links.replace(/'/g, '"'));
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resource links format'
      });
    }
    
    if (resourceLinks.length === 0) {
      return res.json({
        success: true,
        message: 'No documents to process',
        documentsProcessed: 0
      });
    }
    
    // Return immediately and process in background using spawn
    res.json({
      success: true,
      message: `Started processing ${resourceLinks.length} documents in background`,
      documentsScheduled: resourceLinks.length,
      noticeId: noticeId
    });
    
    // Spawn separate Node process for document processing
    const { spawn } = require('child_process');
    const path = require('path');
    
    // Create a separate script for document processing
    const processorScript = path.join(__dirname, '../scripts/process-contract-documents.js');
    
    const child = spawn('node', [processorScript, noticeId, JSON.stringify(resourceLinks)], {
      detached: true,  // Run independently
      stdio: 'ignore'  // Don't pipe output back
    });
    
    child.unref(); // Allow parent process to exit independently
    
    console.log(`📄 [SPAWN] Started document processing for contract ${noticeId} in separate process`);
    
  } catch (error) {
    console.error('Document processing spawn failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add cleanup endpoint for removing duplicate contracts
router.delete('/cleanup-duplicates', async (req, res) => {
  try {
    console.log('🧹 [CLEANUP] Starting programmatic duplicate cleanup...');
    
    // Use the vectorService cleanup method
    const result = await vectorService.removeDuplicateContracts();
    
    res.json({
      success: true,
      message: 'Programmatic duplicate cleanup completed',
      duplicatesRemoved: result.removed,
      errors: result.errors,
      error: result.error || null
    });
    
  } catch (error) {
    console.error('❌ [CLEANUP] Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Duplicate cleanup failed'
    });
  }
});

// Nuclear option - complete vector database reset
router.delete('/reset-vector-database', async (req, res) => {
  try {
    console.log('💥 [RESET] Resetting entire vector database...');
    
    // Clear all contracts and documents from vector database
    const allContracts = await vectorService.contractsIndex.listItems();
    const allDocuments = await vectorService.documentsIndex.listItems();
    
    let contractsRemoved = 0;
    let documentsRemoved = 0;
    let errors = 0;
    
    // Remove all contracts
    for (const contract of allContracts) {
      try {
        await vectorService.contractsIndex.deleteItem(contract.id);
        contractsRemoved++;
      } catch (error) {
        console.error(`❌ Failed to remove contract ${contract.id}`);
        errors++;
      }
    }
    
    // Remove all documents  
    for (const document of allDocuments) {
      try {
        await vectorService.documentsIndex.deleteItem(document.id);
        documentsRemoved++;
      } catch (error) {
        console.error(`❌ Failed to remove document ${document.id}`);
        errors++;
      }
    }
    
    console.log(`💥 [RESET] Vector database reset completed: ${contractsRemoved} contracts removed, ${documentsRemoved} documents removed, ${errors} errors`);

    res.json({
      success: true,
      message: 'Vector database completely reset',
      contractsRemoved,
      documentsRemoved,
      errors
    });

  } catch (error) {
    console.error('❌ [RESET] Vector database reset failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Vector database reset failed'
    });
  }
});

// Re-fetch descriptions for existing contracts that have URL-only descriptions
router.post('/refetch-descriptions', async (req, res) => {
  try {
    const { limit = 50 } = req.body;

    console.log(`📄 [REFETCH] Starting to re-fetch descriptions for contracts with URL-only descriptions...`);

    // Get contracts that have URL-only descriptions (contain api.sam.gov)
    const result = await query(`
      SELECT notice_id, title, description
      FROM contract
      WHERE description LIKE '%api.sam.gov%noticedesc%'
         OR description IS NULL
         OR LENGTH(description) < 100
      LIMIT $1
    `, [limit]);

    const contractsToUpdate = result.rows;

    if (contractsToUpdate.length === 0) {
      return res.json({
        success: true,
        message: 'All contracts already have full descriptions',
        updated: 0
      });
    }

    console.log(`📄 [REFETCH] Found ${contractsToUpdate.length} contracts needing description updates`);

    let updatedCount = 0;
    let errorsCount = 0;
    const updatedContracts = [];

    for (const contract of contractsToUpdate) {
      try {
        // Fetch full description from SAM.gov
        const fullDescription = await fetchFullDescription(contract.notice_id);

        if (fullDescription && fullDescription.length > 100) {
          // Update the database with full description
          await query(`
            UPDATE contract
            SET description = $1, updated_at = NOW()
            WHERE notice_id = $2
          `, [fullDescription, contract.notice_id]);

          updatedContracts.push({
            noticeId: contract.notice_id,
            title: contract.title,
            descriptionLength: fullDescription.length
          });

          updatedCount++;
          console.log(`✅ [${updatedCount}/${contractsToUpdate.length}] Updated description for ${contract.notice_id} (${fullDescription.length} chars)`);
        } else {
          console.warn(`⚠️ No valid description found for ${contract.notice_id}`);
          errorsCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating description for ${contract.notice_id}:`, error.message);
        errorsCount++;
      }
    }

    console.log(`📄 [REFETCH] Completed: ${updatedCount} updated, ${errorsCount} errors`);

    res.json({
      success: true,
      message: `Updated descriptions for ${updatedCount} contracts`,
      updated: updatedCount,
      errors: errorsCount,
      total_found: contractsToUpdate.length,
      updated_contracts: updatedContracts.slice(0, 10) // Show first 10
    });

  } catch (error) {
    console.error('❌ [REFETCH] Description re-fetch failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to re-fetch descriptions'
    });
  }
});

module.exports = router;
