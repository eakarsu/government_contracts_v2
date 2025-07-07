const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

// Import configuration and services
const config = require('./config/env');
const { prisma, testConnection, disconnect } = require('./config/database');
const vectorService = require('./services/vectorService');


// Debug: Log that we're importing routes
console.log('📋 [DEBUG] Importing routes...');

// Import routes
const contractsRouter = require('./routes/contracts');
const documentsRouter = require('./routes/documents');
const searchRouter = require('./routes/search');
const jobsRouter = require('./routes/jobs');
const recommendationsRouter = require('./routes/recommendations');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(config.uploadDir));

// Ensure directories exist
const ensureDirectories = () => {
  const dirs = [config.uploadDir, config.documentsDir, 'public', 'logs'];
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
    cb(null, config.uploadDir);
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
    fileSize: config.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (config.allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed: ${config.allowedExtensions.join(', ')}`), false);
    }
  }
});

// Routes
app.use('/api/contracts', contractsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/search', searchRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/recommendations', recommendationsRouter);

// Mount RFP routes separately to make them accessible at /api/rfp/*
app.use('/api/rfp', documentsRouter);

// Debug: Log when routers are loaded
console.log('📋 [DEBUG] Contracts router mounted at /api/contracts');
console.log('📋 [DEBUG] Documents router mounted at /api/documents');
console.log('📋 [DEBUG] Search router mounted at /api/search');
console.log('📋 [DEBUG] Jobs router mounted at /api/jobs');
console.log('📋 [DEBUG] Recommendations router mounted at /api/recommendations');

// Test that routes are properly loaded
app.get('/api/test-routes', (req, res) => {
  res.json({
    message: 'Route testing endpoint',
    available_routes: [
      'GET /api/documents/ping',
      'GET /api/documents/test', 
      'POST /api/documents/download-test',
      'POST /api/documents/download-all',
      'GET /api/documents/download/debug'
    ],
    timestamp: new Date().toISOString()
  });
});

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
        contracts: '/api/contracts',
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

    // Get vector database stats
    const vectorStats = await vectorService.getCollectionStats();

    // Count downloaded files in the downloaded_documents folder
    let downloadedFilesCount = 0;
    try {
      const downloadPath = path.join(process.cwd(), 'downloaded_documents');
      if (await fs.pathExists(downloadPath)) {
        const files = await fs.readdir(downloadPath);
        downloadedFilesCount = files.length;
      }
    } catch (downloadError) {
      console.warn('Could not count downloaded files:', downloadError.message);
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database_stats: {
        contracts_in_db: contractsCount,
        contracts_indexed: indexedContractsCount,
        documents_indexed: vectorStats.documents,
        downloaded_files: downloadedFilesCount
      },
      vector_stats: vectorStats,
      norshin_api: config.norshinApiUrl
    });
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Environment configuration endpoint for UI
app.get('/api/config', (req, res) => {
  res.json({
    apiBaseUrl: config.apiBaseUrl,
    environment: config.nodeEnv,
    maxFileSize: config.maxFileSize,
    allowedExtensions: config.allowedExtensions,
    features: {
      norshinApi: !!config.norshinApiKey,
      samGovApi: !!config.samGovApiKey,
      openRouterApi: !!config.openRouterApiKey,
      vectorDatabase: true // ChromaDB is always available
    },
    version: require('./package.json').version || '1.0.0'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    norshinAPI: config.norshinApiUrl,
    vectorDB: 'Vectra (Pure Node.js)'
  });
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

// Get list of static documents
app.get('/api/documents', (req, res) => {
  try {
    const documentsDir = path.join(__dirname, config.documentsDir);
    
    if (!fs.existsSync(documentsDir)) {
      return res.json({ documents: [] });
    }

    const files = fs.readdirSync(documentsDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return config.allowedExtensions.includes(ext);
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

// Initialize services and start server
async function startServer() {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize vector database (non-blocking)
    await vectorService.initialize();
    
    // Start server
    app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`);
      console.log(`📁 Upload folder: ${path.join(__dirname, config.uploadDir)}`);
      console.log(`📄 Documents folder: ${path.join(__dirname, config.documentsDir)}`);
      console.log(`🌐 Norshin API: ${config.norshinApiUrl}`);
      console.log(`🔍 Vector DB: Vectra (Pure Node.js) ${vectorService.isConnected ? '(Connected)' : '(Disconnected)'}`);
      console.log(`📊 Database: Connected`);
      console.log(`🔑 Environment: ${config.nodeEnv}`);
      
      if (!vectorService.isConnected) {
        console.log('');
        console.log('💡 Vector search is using pure Node.js implementation');
        console.log('   No external dependencies required!');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await disconnect();
  process.exit(0);
});

// Start the server
startServer();
