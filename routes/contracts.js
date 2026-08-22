const express = require('express');
const axios = require('axios');
const vectorService = require('../services/vectorServiceInstance');
const config = require('../config/env');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

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

    // AI endpoints use the Prisma Contract model. Returning that same source
    // prevents a contract selected in the UI from failing AI lookup later.
    const [totalCount, contracts] = await Promise.all([
      prisma.contract.count({ where }),
      prisma.contract.findMany({
        where,
        orderBy: [{ postedDate: 'desc' }, { createdAt: 'desc' }],
        skip: offset,
        take: parseInt(limit)
      })
    ]);

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

// Get a single contract from the same canonical source used by AI analysis.
router.get('/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;
    const databaseContract = await prisma.contract.findUnique({ where: { noticeId } });
    const contract = databaseContract || await vectorService.getContractById(noticeId);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
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
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function boundedInteger(value, fallback, { min, max, fieldName }) {
  const candidate = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(candidate) || candidate < min || candidate > max) {
    const error = new Error(`${fieldName} must be an integer between ${min} and ${max}`);
    error.statusCode = 400;
    throw error;
  }
  return candidate;
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function contractFromSAM(contractData) {
  const noticeId = optionalString(contractData.noticeId);
  if (!noticeId) return null;

  let postedDate = null;
  if (contractData.postedDate) {
    const candidate = new Date(contractData.postedDate);
    if (!Number.isNaN(candidate.getTime())) postedDate = candidate;
  }

  return {
    noticeId,
    title: optionalString(contractData.title),
    description: optionalString(contractData.description),
    agency: optionalString(contractData.fullParentPathName || contractData.department),
    naicsCode: optionalString(contractData.naicsCode),
    classificationCode: optionalString(contractData.classificationCode),
    postedDate,
    setAsideCode: optionalString(
      contractData.typeOfSetAsideCode || contractData.typeOfSetAside || contractData.setAsideCode
    ),
    resourceLinks: Array.isArray(contractData.resourceLinks) ? contractData.resourceLinks : []
  };
}

function samDocumentLinks(resourceLinks) {
  if (!Array.isArray(resourceLinks)) return [];
  return [...new Set(resourceLinks.filter(link => {
    if (typeof link !== 'string' || !link.trim()) return false;
    try {
      const url = new URL(link);
      const isSamHost = url.hostname === 'sam.gov' || url.hostname.endsWith('.sam.gov');
      return url.protocol === 'https:' && isSamHost && url.pathname.toLowerCase().includes('/download');
    } catch {
      return false;
    }
  }).map(link => link.trim()))];
}

function queuedDocumentFilename(noticeId, documentUrl, index) {
  const segments = new URL(documentUrl).pathname.split('/').filter(Boolean);
  const lastSegment = segments.at(-1);
  const resourceId = lastSegment?.toLowerCase() === 'download' ? segments.at(-2) : lastSegment;
  return `${noticeId}_${resourceId || `document_${index + 1}`}`;
}

async function queueContractDocuments(contract) {
  const links = samDocumentLinks(contract.resourceLinks);
  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const [index, documentUrl] of links.entries()) {
    try {
      const existing = await prisma.documentProcessingQueue.findFirst({
        where: { contractNoticeId: contract.noticeId, documentUrl },
        select: { id: true }
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.documentProcessingQueue.create({
        data: {
          contractNoticeId: contract.noticeId,
          documentUrl,
          description: `SAM.gov document: ${contract.title || 'Untitled'} - ${contract.agency || 'Unknown agency'}`,
          filename: queuedDocumentFilename(contract.noticeId, documentUrl, index),
          status: 'queued'
        }
      });
      queued++;
    } catch (error) {
      console.error(`Unable to queue a document for contract ${contract.noticeId}: ${error.message}`);
      errors++;
    }
  }

  return { queued, skipped, errors };
}

async function getDocumentQueueCounts() {
  const grouped = await prisma.documentProcessingQueue.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  const counts = Object.fromEntries(grouped.map(item => [item.status, item._count.id]));
  const queued = counts.queued || 0;
  const processing = counts.processing || 0;
  const completed = counts.completed || 0;
  const failed = counts.failed || 0;
  return {
    queued,
    processing,
    completed,
    failed,
    total: queued + processing + completed + failed,
    is_processing: processing > 0
  };
}

async function resolveFetchDates(startDateValue, endDateValue) {
  if ((startDateValue && !endDateValue) || (!startDateValue && endDateValue)) {
    const error = new Error('start_date and end_date must be provided together');
    error.statusCode = 400;
    throw error;
  }

  let startDate = startDateValue ? parseDate(startDateValue, 'start_date') : null;
  let endDate = endDateValue ? parseDate(endDateValue, 'end_date') : null;

  // With no explicit range, continue backfilling the 30 days immediately
  // before the oldest stored opportunity. An empty database starts with the
  // most recent 60 days.
  if (!startDate && !endDate) {
    const oldestContract = await prisma.contract.findFirst({
      where: { postedDate: { not: null } },
      orderBy: { postedDate: 'asc' },
      select: { postedDate: true }
    });

    if (oldestContract?.postedDate) {
      startDate = new Date(oldestContract.postedDate);
      startDate.setUTCDate(startDate.getUTCDate() - 30);
      endDate = new Date(oldestContract.postedDate);
      endDate.setUTCDate(endDate.getUTCDate() - 1);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - 60);
    }
  }

  if (startDate > endDate) {
    const error = new Error('start_date must be on or before end_date');
    error.statusCode = 400;
    throw error;
  }

  const maximumRangeMs = 366 * 24 * 60 * 60 * 1000;
  if (endDate.getTime() - startDate.getTime() > maximumRangeMs) {
    const error = new Error('SAM.gov date ranges cannot exceed one year');
    error.statusCode = 400;
    throw error;
  }

  return { startDate, endDate };
}

// Fetch contracts from SAM.gov API
router.post('/fetch', async (req, res) => {
  let job;
  try {
    const { start_date, end_date, limit = 100, offset = 0 } = req.body;
    if (!config.samGovApiKey || !config.samGovApiKey.trim()) {
      return res.status(503).json({ error: 'SAM_GOV_API_KEY is not configured' });
    }

    const fetchLimit = boundedInteger(limit, 100, { min: 1, max: 1000, fieldName: 'limit' });
    const fetchOffset = boundedInteger(offset, 0, { min: 0, max: Number.MAX_SAFE_INTEGER, fieldName: 'offset' });
    const { startDate, endDate } = await resolveFetchDates(start_date, end_date);

    job = await prisma.indexingJob.create({
      data: { jobType: 'contracts', status: 'running', startDate, endDate }
    });

    const response = await axios.get('https://api.sam.gov/opportunities/v2/search', {
      params: {
        api_key: config.samGovApiKey,
        limit: fetchLimit,
        offset: fetchOffset,
        postedFrom: formatDateForSAM(startDate),
        postedTo: formatDateForSAM(endDate)
      },
      timeout: 120000
    });
    const contractsData = Array.isArray(response.data?.opportunitiesData)
      ? response.data.opportunitiesData
      : [];

    let processedCount = 0;
    let errorsCount = 0;
    let documentsQueued = 0;
    let documentsSkipped = 0;
    let documentQueueErrors = 0;

    for (const contractData of contractsData) {
      const contractDetails = contractFromSAM(contractData);
      if (!contractDetails) {
        errorsCount++;
        continue;
      }

      try {
        await prisma.contract.upsert({
          where: { noticeId: contractDetails.noticeId },
          create: contractDetails,
          update: { ...contractDetails, indexedAt: null }
        });
        processedCount++;

        const queueResult = await queueContractDocuments(contractDetails);
        documentsQueued += queueResult.queued;
        documentsSkipped += queueResult.skipped;
        documentQueueErrors += queueResult.errors;
      } catch (error) {
        console.error(`Error processing SAM.gov contract ${contractDetails.noticeId}: ${error.message}`);
        errorsCount++;
      }
    }

    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: errorsCount > 0 ? 'completed_with_errors' : 'completed',
        recordsProcessed: processedCount,
        errorsCount,
        completedAt: new Date()
      }
    });

    const queueStatus = await getDocumentQueueCounts();

    return res.json({
      success: true,
      job_id: job.id,
      contracts_processed: processedCount,
      errors: errorsCount,
      documents_queued: documentsQueued,
      documents_skipped: documentsSkipped,
      document_queue_errors: documentQueueErrors,
      queue_status: queueStatus,
      total_available: Number(response.data?.totalRecords) || 0,
      date_range: {
        posted_from: formatDateForSAM(startDate),
        posted_to: formatDateForSAM(endDate)
      }
    });
  } catch (error) {
    const providerStatus = error.response?.status;
    const safeMessage = providerStatus
      ? `SAM.gov API request failed with status ${providerStatus}`
      : error.message;

    if (job) {
      try {
        await prisma.indexingJob.update({
          where: { id: job.id },
          data: { status: 'failed', errorDetails: safeMessage, completedAt: new Date() }
        });
      } catch (jobError) {
        console.error(`Unable to mark fetch job ${job.id} as failed: ${jobError.message}`);
      }
    }

    console.error(`Contract fetch failed: ${safeMessage}`);
    return res.status(error.statusCode || (providerStatus ? 502 : 500)).json({ error: safeMessage });
  }
});

// Index contracts in vector database
router.post('/index', async (req, res) => {
  let job;
  try {
    const { limit = 100 } = req.body;
    const indexLimit = boundedInteger(limit, 100, { min: 1, max: 1000, fieldName: 'limit' });

    // Get contracts that haven't been indexed yet
    const contracts = await prisma.contract.findMany({
      where: { indexedAt: null },
      orderBy: { id: 'asc' },
      take: indexLimit
    });

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
    job = await prisma.indexingJob.create({
      data: { jobType: 'contracts_indexing', status: 'running' }
    });

    let indexedCount = 0;
    let errorsCount = 0;

    for (const contract of contracts) {
      try {
        const indexed = await vectorService.indexContract(contract);
        if (!indexed) throw new Error('Vector service did not index the contract');
        await prisma.contract.update({
          where: { id: contract.id },
          data: { indexedAt: new Date() }
        });

        indexedCount++;
        if (indexedCount % 10 === 0) {
          console.log(`Indexed ${indexedCount} contracts so far...`);
        }
      } catch (error) {
        console.error(`Error indexing contract ${contract.noticeId}: ${error.message}`);
        errorsCount++;
      }
    }

    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: errorsCount > 0 ? 'completed_with_errors' : 'completed',
        recordsProcessed: indexedCount,
        errorsCount,
        completedAt: new Date()
      }
    });

    return res.json({
      success: true,
      job_id: job.id,
      indexed_count: indexedCount,
      errors_count: errorsCount
    });
  } catch (error) {
    if (job) {
      try {
        await prisma.indexingJob.update({
          where: { id: job.id },
          data: { status: 'failed', errorDetails: error.message, completedAt: new Date() }
        });
      } catch (jobError) {
        console.error(`Unable to mark indexing job ${job.id} as failed: ${jobError.message}`);
      }
    }
    console.error(`Contract indexing failed: ${error.message}`);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Search contracts endpoint
router.post('/search', async (req, res) => {
  try {
    const startTime = Date.now();
    const { query: searchText, limit = 10 } = req.body;
    let { use_vector = true } = req.body;

    if (!searchText) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const searchLimit = boundedInteger(limit, 10, { min: 1, max: 50, fieldName: 'limit' });

    let contracts = [];

    if (use_vector) {
      // Use vector search
      try {
        const vectorPage = await vectorService.searchContracts(searchText, { limit: searchLimit });
        const vectorResults = vectorPage.results;
        
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
      contracts = await prisma.contract.findMany({
        where: {
          OR: [
            { title: { contains: searchText, mode: 'insensitive' } },
            { description: { contains: searchText, mode: 'insensitive' } },
            { agency: { contains: searchText, mode: 'insensitive' } }
          ]
        },
        orderBy: [{ postedDate: 'desc' }, { createdAt: 'desc' }],
        take: searchLimit
      });
    }

    const responseTime = (Date.now() - startTime) / 1000;

    // Log search query
    await prisma.searchQuery.create({
      data: {
        queryText: searchText,
        resultsCount: contracts.length,
        responseTime,
        userIp: req.ip
      }
    });

    res.json({
      query: searchText,
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
    
    const contract = await prisma.contract.findUnique({ where: { noticeId } });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.status(501).json({
      contract_id: noticeId,
      error: 'Contract analysis is unavailable until a validated analysis pipeline is configured.',
    });

  } catch (error) {
    console.error('Contract analysis failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
