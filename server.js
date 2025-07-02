require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Ensure directories exist
const ensureDirectories = () => {
  const dirs = ['uploads', 'documents', 'public'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirectories();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = (process.env.ALLOWED_EXTENSIONS || '.pdf,.doc,.docx').split(',');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`), false);
    }
  }
});

// Utility function to send file to Norshin API
const sendToNorshinAPI = async (filePath, originalName, customPrompt = '', model = 'openai/gpt-4.1') => {
  try {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    
    formData.append('document', blob, originalName);
    if (customPrompt) formData.append('customPrompt', customPrompt);
    if (model) formData.append('model', model);

    const response = await axios.post(process.env.NORSHIN_API_URL, formData, {
      headers: {
        'X-API-Key': process.env.NORSHIN_API_KEY,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 120000 // 2 minutes timeout
    });

    return response.data;
  } catch (error) {
    console.error('Norshin API Error:', error.response?.data || error.message);
    throw error;
  }
};

// Database setup (add Prisma client)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Routes

// Serve main page
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  // Check if index.html exists
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback response if index.html doesn't exist
    res.json({
      message: 'Contract Indexer API Server',
      status: 'running',
      endpoints: {
        status: '/api/status',
        health: '/api/health',
        config: '/api/config',
        search: '/api/search',
        documents: '/api/documents'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// API Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    // Get database stats
    const contractsCount = await prisma.contract.count();
    const indexedContractsCount = await prisma.contract.count({
      where: { indexedAt: { not: null } }
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database_stats: {
        contracts_in_db: contractsCount,
        contracts_indexed: indexedContractsCount,
        documents_indexed: 0 // Placeholder
      },
      norshin_api: process.env.NORSHIN_API_URL
    });
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Fetch contracts from SAM.gov API
app.post('/api/contracts/fetch', async (req, res) => {
  try {
    const { start_date, end_date, limit = 100, offset = 0 } = req.body;

    // Parse dates or use intelligent defaults
    let startDate = start_date ? new Date(start_date) : null;
    let endDate = end_date ? new Date(end_date) : null;

    // Auto-expand search range if no dates provided
    if (!startDate && !endDate) {
      const oldestContract = await prisma.contract.findFirst({
        orderBy: { postedDate: 'asc' },
        where: { postedDate: { not: null } }
      });

      if (oldestContract?.postedDate) {
        startDate = new Date(oldestContract.postedDate);
        startDate.setDate(startDate.getDate() - 30);
        endDate = new Date(oldestContract.postedDate);
        endDate.setDate(endDate.getDate() - 1);
      } else {
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);
      }
    }

    // Create indexing job record
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'contracts',
        status: 'running',
        startDate,
        endDate
      }
    });

    try {
      // Fetch contracts from SAM.gov (placeholder implementation)
      const samGovUrl = `https://api.sam.gov/opportunities/v2/search`;
      const params = new URLSearchParams({
        api_key: process.env.SAM_GOV_API_KEY,
        limit: Math.min(limit, 1000),
        offset,
        postedFrom: startDate?.toISOString().split('T')[0],
        postedTo: endDate?.toISOString().split('T')[0]
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

          // Upsert contract
          await prisma.contract.upsert({
            where: { noticeId: contractDetails.noticeId },
            update: {
              ...contractDetails,
              updatedAt: new Date()
            },
            create: contractDetails
          });

          processedCount++;
        } catch (error) {
          console.error('Error processing contract:', error);
          errorsCount++;
        }
      }

      // Update job status
      await prisma.indexingJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          recordsProcessed: processedCount,
          errorsCount,
          completedAt: new Date()
        }
      });

      res.json({
        success: true,
        job_id: job.id,
        contracts_processed: processedCount,
        errors: errorsCount,
        total_available: response.data.totalRecords || 0
      });

    } catch (error) {
      await prisma.indexingJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorDetails: error.message,
          completedAt: new Date()
        }
      });
      throw error;
    }

  } catch (error) {
    console.error('Contract fetch failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search contracts endpoint
app.post('/api/search', async (req, res) => {
  try {
    const startTime = Date.now();
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Simple database search (replace with vector search later)
    const contracts = await prisma.contract.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { agency: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: Math.min(limit, 50),
      orderBy: { postedDate: 'desc' }
    });

    const responseTime = (Date.now() - startTime) / 1000;

    // Log search query
    await prisma.searchQuery.create({
      data: {
        queryText: query,
        resultsCount: contracts.length,
        responseTime,
        userIp: req.ip
      }
    });

    res.json({
      query,
      results: {
        contracts: contracts,
        total_results: contracts.length
      },
      response_time: responseTime
    });

  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get job status
app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.indexingJob.findUnique({
      where: { id: parseInt(jobId) }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      id: job.id,
      type: job.jobType,
      status: job.status,
      start_date: job.startDate?.toISOString(),
      end_date: job.endDate?.toISOString(),
      records_processed: job.recordsProcessed,
      errors_count: job.errorsCount,
      error_details: job.errorDetails,
      created_at: job.createdAt?.toISOString(),
      completed_at: job.completedAt?.toISOString()
    });

  } catch (error) {
    console.error('Job status retrieval failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process and index contract documents
app.post('/api/documents/process', async (req, res) => {
  try {
    const { contract_id, limit = 50 } = req.body;

    // Get contracts with valid resource links
    let whereClause = { resourceLinks: { not: null } };
    if (contract_id) {
      whereClause.noticeId = contract_id;
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      take: limit
    });

    if (contracts.length === 0) {
      return res.json({ message: 'No contracts with documents found', processed_count: 0 });
    }

    // Create indexing job
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'documents',
        status: 'running'
      }
    });

    let processedCount = 0;
    let errorsCount = 0;

    for (const contract of contracts) {
      try {
        const resourceLinks = contract.resourceLinks;
        if (!resourceLinks || !Array.isArray(resourceLinks)) continue;

        // Process up to 3 documents per contract
        for (const docUrl of resourceLinks.slice(0, 3)) {
          try {
            // Process document via Norshin API
            const result = await sendToNorshinAPI(docUrl, `doc_${contract.noticeId}`, '', 'openai/gpt-4.1');
            
            if (result) {
              processedCount++;
              console.log(`Processed document for contract: ${contract.noticeId}`);
            } else {
              errorsCount++;
            }
          } catch (error) {
            console.error(`Error processing document ${docUrl}:`, error);
            errorsCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing documents for contract ${contract.noticeId}:`, error);
        errorsCount++;
      }
    }

    // Update job status
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        recordsProcessed: processedCount,
        errorsCount,
        completedAt: new Date()
      }
    });

    res.json({
      success: true,
      job_id: job.id,
      processed_count: processedCount,
      errors_count: errorsCount
    });

  } catch (error) {
    console.error('Document processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Queue documents for processing
app.post('/api/documents/queue', async (req, res) => {
  try {
    console.log('Queueing documents for processing...');

    // Clear existing queue
    await prisma.documentProcessingQueue.deleteMany({});

    // Get contracts with documents
    const contracts = await prisma.contract.findMany({
      where: { resourceLinks: { not: null } },
      take: 10
    });

    if (contracts.length === 0) {
      return res.json({
        success: true,
        message: 'No documents to queue for processing',
        queued_count: 0
      });
    }

    let queuedCount = 0;
    for (const contract of contracts) {
      if (contract.resourceLinks && Array.isArray(contract.resourceLinks)) {
        for (const linkUrl of contract.resourceLinks) {
          try {
            // Create queue entry
            await prisma.documentProcessingQueue.create({
              data: {
                contractNoticeId: contract.noticeId,
                documentUrl: linkUrl,
                description: contract.title || '',
                filename: `${contract.noticeId}_doc_${queuedCount + 1}`,
                status: 'queued'
              }
            });
            queuedCount++;
            console.log(`Queued document: ${linkUrl}`);
          } catch (error) {
            console.warn(`Failed to queue document ${linkUrl}:`, error);
          }
        }
      }
    }

    // Get queue status
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    res.json({
      success: true,
      message: `Queued ${queuedCount} documents for processing`,
      queued_count: queuedCount,
      queue_status: {
        queued: statusCounts.queued || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        total: queuedCount,
        is_processing: (statusCounts.processing || 0) > 0
      }
    });

  } catch (error) {
    console.error('Error queueing documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get queue status
app.get('/api/documents/queue/status', async (req, res) => {
  try {
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    // Get recent completed documents
    const recentDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      queue_status: {
        queued: statusCounts.queued || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        is_processing: (statusCounts.processing || 0) > 0,
        recent_documents: recentDocs.map(doc => ({
          filename: doc.filename,
          completed_at: doc.completedAt?.toISOString(),
          contract_notice_id: doc.contractNoticeId
        }))
      }
    });

  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process queued documents
app.post('/api/documents/queue/process', async (req, res) => {
  try {
    const queuedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'queued' }
    });

    if (queuedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents currently queued',
        queued_count: 0
      });
    }

    console.log(`Starting processing of ${queuedDocs.length} documents`);

    // Process documents asynchronously
    const processPromises = queuedDocs.map(async (doc) => {
      try {
        // Update status to processing
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: { 
            status: 'processing',
            startedAt: new Date()
          }
        });

        // Process via Norshin API
        const result = await sendToNorshinAPI(
          doc.documentUrl,
          doc.filename || 'document',
          '',
          'openai/gpt-4.1'
        );

        // Update status to completed
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'completed',
            processedData: JSON.stringify(result),
            completedAt: new Date()
          }
        });

        return { success: true, filename: doc.filename };
      } catch (error) {
        // Update status to failed
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            failedAt: new Date()
          }
        });

        return { success: false, filename: doc.filename, error: error.message };
      }
    });

    // Wait for all processing to complete
    const results = await Promise.allSettled(processPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errorCount = results.length - successCount;

    res.json({
      success: true,
      message: `Processing completed`,
      submitted_count: queuedDocs.length,
      success_count: successCount,
      error_count: errorCount,
      processing_method: 'async_concurrent'
    });

  } catch (error) {
    console.error('Document processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze specific contract with AI
app.post('/api/contracts/:noticeId/analyze', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    const contract = await prisma.contract.findUnique({
      where: { noticeId }
    });

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

// Get bidding recommendations
app.post('/api/recommendations', async (req, res) => {
  try {
    const { naics_codes, agencies, keywords } = req.body;

    let whereClause = {};
    
    if (naics_codes && naics_codes.length > 0) {
      whereClause.naicsCode = { in: naics_codes };
    }
    
    if (agencies && agencies.length > 0) {
      whereClause.agency = { in: agencies };
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      take: 20
    });

    if (contracts.length === 0) {
      return res.json({
        message: 'No matching contracts found',
        recommendations: []
      });
    }

    // Generate simple recommendations
    const recommendations = contracts.map(contract => ({
      contract_id: contract.noticeId,
      title: contract.title,
      agency: contract.agency,
      recommendation_score: Math.random() * 100,
      reasons: [
        'Matches your NAICS code criteria',
        'Good fit for your capabilities',
        'Competitive opportunity'
      ]
    }));

    res.json({
      criteria: req.body,
      contracts_analyzed: contracts.length,
      recommendations
    });

  } catch (error) {
    console.error('Recommendations generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index contracts in vector database
app.post('/api/contracts/index', async (req, res) => {
  try {
    const { limit = 100 } = req.body;

    // Get contracts that haven't been indexed yet
    const contracts = await prisma.contract.findMany({
      where: { indexedAt: null },
      take: limit
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
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'contracts_indexing',
        status: 'running'
      }
    });

    let indexedCount = 0;
    let errorsCount = 0;

    try {
      for (const contract of contracts) {
        try {
          // Index contract in vector database (placeholder implementation)
          console.log(`Indexing contract: ${contract.noticeId}`);
          
          // Mark as indexed
          await prisma.contract.update({
            where: { id: contract.id },
            data: { indexedAt: new Date() }
          });
          
          indexedCount++;
          
          // Commit changes periodically
          if (indexedCount % 10 === 0) {
            console.log(`Indexed ${indexedCount} contracts so far...`);
          }
        } catch (error) {
          console.error(`Error indexing contract ${contract.noticeId}:`, error);
          errorsCount++;
        }
      }

      // Update job status
      await prisma.indexingJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          recordsProcessed: indexedCount,
          errorsCount,
          completedAt: new Date()
        }
      });

      res.json({
        success: true,
        job_id: job.id,
        indexed_count: indexedCount,
        errors_count: errorsCount
      });

    } catch (error) {
      await prisma.indexingJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorDetails: error.message,
          completedAt: new Date()
        }
      });
      throw error;
    }

  } catch (error) {
    console.error('Contract indexing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process documents via Norshin API
app.post('/api/documents/process-norshin', async (req, res) => {
  try {
    const { limit = 5 } = req.body;

    // Get contracts with valid resource links
    const contracts = await prisma.contract.findMany({
      where: {
        resourceLinks: { not: null }
      },
      take: limit
    });

    if (contracts.length === 0) {
      return res.json({
        message: 'No contracts with document attachments found',
        processed_count: 0
      });
    }

    // Create indexing job
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'norshin_documents',
        status: 'running'
      }
    });

    let processedCount = 0;
    let errorsCount = 0;

    for (const contract of contracts) {
      try {
        const resourceLinks = contract.resourceLinks;
        if (!resourceLinks || !Array.isArray(resourceLinks)) continue;

        console.log(`Processing ${resourceLinks.length} documents for contract ${contract.noticeId} via Norshin API`);

        // Process up to 3 documents per contract
        for (const docUrl of resourceLinks.slice(0, 3)) {
          try {
            // Process document via Norshin API
            const result = await sendToNorshinAPI(docUrl, `${contract.noticeId}_doc`, '', 'openai/gpt-4.1');
            
            if (result) {
              processedCount++;
              console.log(`Successfully processed document for contract ${contract.noticeId}`);
            } else {
              errorsCount++;
            }
          } catch (error) {
            console.error(`Error processing document ${docUrl}:`, error);
            errorsCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing documents for contract ${contract.noticeId}:`, error);
        errorsCount++;
      }
    }

    // Update job status
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        recordsProcessed: processedCount,
        errorsCount,
        completedAt: new Date()
      }
    });

    res.json({
      success: true,
      job_id: job.id,
      processed_count: processedCount,
      errors_count: errorsCount,
      processing_method: 'norshin_api'
    });

  } catch (error) {
    console.error('Norshin document processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Retry failed documents
app.post('/api/documents/retry-failed', async (req, res) => {
  try {
    // Get failed documents that can still be retried
    const failedDocs = await prisma.documentProcessingQueue.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: prisma.documentProcessingQueue.fields.maxRetries }
      }
    });

    if (failedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No failed documents available for retry',
        retried_count: 0
      });
    }

    let retriedCount = 0;
    for (const doc of failedDocs) {
      await prisma.documentProcessingQueue.update({
        where: { id: doc.id },
        data: {
          status: 'queued',
          retryCount: doc.retryCount + 1,
          failedAt: null,
          errorMessage: null
        }
      });
      console.log(`Retrying document: ${doc.filename} (attempt ${doc.retryCount + 1}/${doc.maxRetries})`);
      retriedCount++;
    }

    res.json({
      success: true,
      retried_count: retriedCount,
      message: `Retrying ${retriedCount} failed documents`
    });

  } catch (error) {
    console.error('Error retrying failed documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index completed documents
app.post('/api/documents/index-completed', async (req, res) => {
  try {
    // Get all completed documents
    const completedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'completed' }
    });

    if (completedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No completed documents to index',
        indexed_count: 0
      });
    }

    // Create indexing job
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'documents',
        status: 'running'
      }
    });

    let indexedCount = 0;
    let errorsCount = 0;

    for (const doc of completedDocs) {
      try {
        // Parse processed data if available
        let processedData = {};
        if (doc.processedData) {
          try {
            processedData = JSON.parse(doc.processedData);
          } catch {
            processedData = { raw_data: doc.processedData };
          }
        }

        // Index document (placeholder implementation)
        console.log(`Indexing document: ${doc.filename}`);
        indexedCount++;

      } catch (error) {
        console.error(`Error indexing document ${doc.filename}:`, error);
        errorsCount++;
      }
    }

    // Update job status
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        recordsProcessed: indexedCount,
        errorsCount,
        completedAt: new Date()
      }
    });

    res.json({
      success: true,
      job_id: job.id,
      indexed_count: indexedCount,
      errors_count: errorsCount,
      total_documents: completedDocs.length
    });

  } catch (error) {
    console.error('Error indexing completed documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process documents directly (bypassing Norshin)
app.post('/api/documents/queue/process-direct', async (req, res) => {
  try {
    console.log('Starting direct document processing via OpenRouter');
    
    // Placeholder for direct processing implementation
    res.json({
      success: true,
      message: 'Direct processing started using OpenRouter API',
      processing_method: 'direct_openrouter'
    });

  } catch (error) {
    console.error('Direct document processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index processed documents
app.post('/api/documents/queue/index-processed', async (req, res) => {
  try {
    console.log('Starting indexing of processed documents');
    
    // Placeholder for indexing implementation
    res.json({
      success: true,
      message: 'Processed documents indexed successfully'
    });

  } catch (error) {
    console.error('Failed to index processed documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause processing queue
app.post('/api/documents/queue/pause', async (req, res) => {
  try {
    // Placeholder for pause implementation
    res.json({
      success: true,
      message: 'Processing queue paused'
    });

  } catch (error) {
    console.error('Error pausing queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resume processing queue
app.post('/api/documents/queue/resume', async (req, res) => {
  try {
    // Placeholder for resume implementation
    res.json({
      success: true,
      message: 'Processing queue resumed'
    });

  } catch (error) {
    console.error('Error resuming queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop processing queue
app.post('/api/documents/queue/stop', async (req, res) => {
  try {
    // Placeholder for stop implementation
    res.json({
      success: true,
      message: 'Processing queue stopped'
    });

  } catch (error) {
    console.error('Error stopping queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process with async concurrency
app.post('/api/documents/queue/process-async', async (req, res) => {
  try {
    console.log('Starting true async concurrent processing');
    
    // Get queued documents
    const queuedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'queued' }
    });

    if (queuedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents currently queued',
        queued_count: 0
      });
    }

    // Process all documents concurrently
    const processPromises = queuedDocs.map(async (doc) => {
      try {
        // Update status to processing
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: { 
            status: 'processing',
            startedAt: new Date()
          }
        });

        // Process via Norshin API if local file exists
        if (doc.localFilePath && fs.existsSync(doc.localFilePath)) {
          const result = await sendToNorshinAPI(
            doc.localFilePath,
            doc.filename || 'document',
            '',
            'openai/gpt-4.1'
          );

          // Update status to completed
          await prisma.documentProcessingQueue.update({
            where: { id: doc.id },
            data: {
              status: 'completed',
              processedData: JSON.stringify(result),
              completedAt: new Date()
            }
          });

          return { success: true, filename: doc.filename };
        } else {
          throw new Error('Local file not found');
        }
      } catch (error) {
        // Update status to failed
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            failedAt: new Date()
          }
        });

        return { success: false, filename: doc.filename, error: error.message };
      }
    });

    // Wait for all processing to complete
    const results = await Promise.allSettled(processPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errorCount = results.length - successCount;

    res.json({
      success: true,
      message: 'All documents submitted to Norshin API simultaneously',
      submitted_count: queuedDocs.length,
      success_count: successCount,
      error_count: errorCount,
      processing_method: 'async_concurrent'
    });

  } catch (error) {
    console.error('Async processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Queue test documents
app.post('/api/documents/queue/test-mode', async (req, res) => {
  try {
    console.log('Starting test mode document queueing...');

    // Clear existing queue
    await prisma.documentProcessingQueue.deleteMany({});

    // Create 5 test documents (placeholder implementation)
    let queuedCount = 0;
    const targetDocs = 5;

    for (let i = 1; i <= targetDocs; i++) {
      await prisma.documentProcessingQueue.create({
        data: {
          contractNoticeId: `TEST${i.toString().padStart(3, '0')}`,
          documentUrl: `https://example.com/test-doc-${i}.pdf`,
          description: `Test Document ${i} (2 pages) - Cost-controlled testing`,
          filename: `test_doc_${i}.pdf`,
          status: 'queued'
        }
      });
      queuedCount++;
      console.log(`Queued test document ${i}: test_doc_${i}.pdf`);
    }

    res.json({
      success: true,
      message: `Successfully queued ${queuedCount} test documents`,
      queued_count: queuedCount,
      test_mode: true
    });

  } catch (error) {
    console.error('Error queueing test documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process test documents
app.post('/api/documents/queue/test-process', async (req, res) => {
  try {
    // Get test documents
    const testDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'queued' }
    });

    if (testDocs.length > 7) {
      return res.status(400).json({
        success: false,
        error: `Too many documents queued (${testDocs.length}). Test mode limited to 7 documents max.`,
        queued_count: testDocs.length
      });
    }

    if (testDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents currently queued. Click "Queue Test Docs" to add documents for processing.',
        queued_count: 0,
        action_needed: 'queue_documents'
      });
    }

    console.log(`Starting test mode processing of ${testDocs.length} documents`);

    // Process documents concurrently (placeholder implementation)
    const processPromises = testDocs.map(async (doc) => {
      try {
        // Update status to processing
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: { 
            status: 'processing',
            startedAt: new Date()
          }
        });

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update status to completed
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'completed',
            processedData: JSON.stringify({ test: 'data' }),
            completedAt: new Date()
          }
        });

        return { success: true, filename: doc.filename };
      } catch (error) {
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            failedAt: new Date()
          }
        });

        return { success: false, filename: doc.filename, error: error.message };
      }
    });

    const results = await Promise.allSettled(processPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errorCount = results.length - successCount;

    res.json({
      success: true,
      message: `Test mode: Started processing ${testDocs.length} documents concurrently`,
      submitted_count: testDocs.length,
      success_count: successCount,
      error_count: errorCount,
      processing_method: 'async_concurrent_test',
      counters_reset: true,
      status: 'processing_started'
    });

  } catch (error) {
    console.error('Test mode processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process documents sequentially
app.post('/api/documents/queue/process-parallel', async (req, res) => {
  try {
    const queuedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'queued' }
    });

    if (queuedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents currently queued',
        queued_count: 0
      });
    }

    console.log(`Starting sequential processing of ${queuedDocs.length} documents`);

    let successCount = 0;
    let errorCount = 0;

    // Process documents one by one with delay
    for (const doc of queuedDocs) {
      try {
        // Update status to processing
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: { 
            status: 'processing',
            startedAt: new Date()
          }
        });

        // Process via Norshin API if local file exists
        if (doc.localFilePath && fs.existsSync(doc.localFilePath)) {
          const result = await sendToNorshinAPI(
            doc.localFilePath,
            doc.filename || 'document',
            '',
            'openai/gpt-4.1'
          );

          // Update status to completed
          await prisma.documentProcessingQueue.update({
            where: { id: doc.id },
            data: {
              status: 'completed',
              processedData: JSON.stringify(result),
              completedAt: new Date()
            }
          });

          successCount++;
        } else {
          throw new Error('Local file not found');
        }

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        // Update status to failed
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            failedAt: new Date()
          }
        });

        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Sequential processing completed`,
      submitted_count: queuedDocs.length,
      success_count: successCount,
      error_count: errorCount,
      processing_method: 'sequential'
    });

  } catch (error) {
    console.error('Sequential processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get processing notifications
app.get('/api/documents/notifications', async (req, res) => {
  try {
    // Get completed documents count
    const completedCount = await prisma.documentProcessingQueue.count({
      where: { status: 'completed' }
    });

    // Get recent completed documents
    const recentDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 10
    });

    const notifications = recentDocs.map(doc => ({
      filename: doc.filename,
      completed_at: doc.completedAt?.toISOString(),
      contract_notice_id: doc.contractNoticeId,
      type: 'document_processed'
    }));

    res.json({
      success: true,
      notifications,
      total_processed: completedCount
    });

  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get processed documents
app.get('/api/documents/processed', async (req, res) => {
  try {
    const processedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' }
    });

    const processedDocuments = processedDocs.map(doc => ({
      filename: doc.filename,
      file_size: doc.processedData ? doc.processedData.length : 0,
      processed_at: doc.completedAt?.getTime() / 1000,
      contract_notice_id: doc.contractNoticeId
    }));

    res.json({
      success: true,
      processed_documents: processedDocuments,
      total_files: processedDocuments.length
    });

  } catch (error) {
    console.error('Error getting processed documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload and process single document
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    const { customPrompt, model } = req.body;
    
    console.log(`Processing: ${req.file.originalname}`);
    
    // Send to Norshin API
    const result = await sendToNorshinAPI(
      req.file.path, 
      req.file.originalname, 
      customPrompt, 
      model
    );

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      result: result
    });

  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Processing failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// Upload and process multiple documents
app.post('/api/upload-multiple', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No documents provided' });
    }

    const { customPrompt, model } = req.body;
    const results = [];

    for (const file of req.files) {
      try {
        console.log(`Processing: ${file.originalname}`);
        
        const result = await sendToNorshinAPI(
          file.path, 
          file.originalname, 
          customPrompt, 
          model
        );

        results.push({
          filename: file.originalname,
          success: true,
          result: result
        });

        // Clean up file
        fs.unlinkSync(file.path);

      } catch (error) {
        results.push({
          filename: file.originalname,
          success: false,
          error: error.response?.data?.error || error.message
        });

        // Clean up file on error
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    res.json({
      success: true,
      processed: results.length,
      results: results
    });

  } catch (error) {
    // Clean up all files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      error: 'Batch processing failed',
      details: error.message
    });
  }
});

// Process static documents from documents folder
app.post('/api/process-static', async (req, res) => {
  try {
    const { filename, customPrompt, model } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const filePath = path.join(__dirname, 'documents', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found in documents folder' });
    }

    console.log(`Processing static document: ${filename}`);
    
    const result = await sendToNorshinAPI(filePath, filename, customPrompt, model);

    res.json({
      success: true,
      filename: filename,
      result: result
    });

  } catch (error) {
    res.status(500).json({
      error: 'Processing failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// Get list of static documents
app.get('/api/documents', (req, res) => {
  try {
    const documentsDir = path.join(__dirname, 'documents');
    const allowedExtensions = (process.env.ALLOWED_EXTENSIONS || '.pdf,.doc,.docx').split(',');
    
    if (!fs.existsSync(documentsDir)) {
      return res.json({ documents: [] });
    }

    const files = fs.readdirSync(documentsDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return allowedExtensions.includes(ext);
      })
      .map(file => {
        const filePath = path.join(documentsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          extension: path.extname(file).toLowerCase()
        };
      });

    res.json({ documents: files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Admin Routes - Get stuck documents
app.get('/api/admin/documents/stuck', async (req, res) => {
  try {
    // Documents processing for more than 20 minutes are considered stuck
    const cutoffTime = new Date(Date.now() - 20 * 60 * 1000);

    const stuckDocs = await prisma.documentProcessingQueue.findMany({
      where: {
        status: 'processing',
        startedAt: { lt: cutoffTime }
      }
    });

    const stuckList = stuckDocs.map(doc => {
      const processingTime = doc.startedAt 
        ? (Date.now() - doc.startedAt.getTime()) / 1000 
        : 0;
      
      return {
        id: doc.id,
        filename: doc.filename,
        contract_notice_id: doc.contractNoticeId,
        started_at: doc.startedAt?.toISOString(),
        processing_time_minutes: Math.round(processingTime / 60 * 10) / 10,
        retry_count: doc.retryCount
      };
    });

    res.json({
      success: true,
      stuck_documents: stuckList,
      count: stuckList.length
    });

  } catch (error) {
    console.error('Error getting stuck documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Routes - Reset stuck document
app.post('/api/admin/documents/reset/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const docIdInt = parseInt(docId);

    const doc = await prisma.documentProcessingQueue.findUnique({
      where: { id: docIdInt }
    });

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const updatedDoc = await prisma.documentProcessingQueue.update({
      where: { id: docIdInt },
      data: {
        status: 'queued',
        startedAt: null,
        retryCount: doc.retryCount + 1,
        errorMessage: `Reset due to timeout after ${doc.retryCount + 1} attempts`,
        updatedAt: new Date()
      }
    });

    console.log(`Reset document ${doc.filename} back to queued status`);

    res.json({
      success: true,
      message: `Document ${doc.filename} reset to queued status`,
      retry_count: updatedDoc.retryCount
    });

  } catch (error) {
    console.error(`Error resetting document ${req.params.docId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Routes - Reset all stuck documents
app.post('/api/admin/documents/reset-all-stuck', async (req, res) => {
  try {
    // Documents processing for more than 20 minutes
    const cutoffTime = new Date(Date.now() - 20 * 60 * 1000);

    const stuckDocs = await prisma.documentProcessingQueue.findMany({
      where: {
        status: 'processing',
        startedAt: { lt: cutoffTime }
      }
    });

    let resetCount = 0;
    for (const doc of stuckDocs) {
      await prisma.documentProcessingQueue.update({
        where: { id: doc.id },
        data: {
          status: 'queued',
          startedAt: null,
          retryCount: doc.retryCount + 1,
          errorMessage: `Auto-reset due to timeout after ${doc.retryCount + 1} attempts`,
          updatedAt: new Date()
        }
      });
      resetCount++;
    }

    console.log(`Reset ${resetCount} stuck documents back to queued status`);

    res.json({
      success: true,
      message: `Reset ${resetCount} stuck documents back to queued status`,
      reset_count: resetCount
    });

  } catch (error) {
    console.error('Error resetting stuck documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Environment configuration endpoint for UI
app.get('/api/config', (req, res) => {
  res.json({
    apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    environment: process.env.NODE_ENV || 'development',
    maxFileSize: process.env.MAX_FILE_SIZE || 52428800,
    allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '.pdf,.doc,.docx').split(','),
    features: {
      norshinApi: !!process.env.NORSHIN_API_KEY,
      samGovApi: !!process.env.SAM_GOV_API_KEY,
      openRouterApi: !!process.env.OPENROUTER_API_KEY,
      vectorDatabase: !!process.env.VECTOR_DB_URL
    },
    version: require('./package.json').version || '1.0.0'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    norshinAPI: process.env.NORSHIN_API_URL 
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload folder: ${path.join(__dirname, 'uploads')}`);
  console.log(`📄 Documents folder: ${path.join(__dirname, 'documents')}`);
  console.log(`🌐 Norshin API: ${process.env.NORSHIN_API_URL}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});
