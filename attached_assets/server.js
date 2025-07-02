// server.js
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

