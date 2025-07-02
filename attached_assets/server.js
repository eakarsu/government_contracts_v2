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

