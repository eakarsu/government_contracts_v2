const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

// Import configuration and services
const config = require('./config/env');
const { prisma, testConnection, disconnect } = require('./config/database');
const vectorService = require('./services/vectorService');
const { sendToNorshinAPI } = require('./services/norshinService');

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

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database_stats: {
        contracts_in_db: contractsCount,
        contracts_indexed: indexedContractsCount,
        documents_indexed: vectorStats.documents
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
    vectorDB: config.chromaUrl
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize services and start server
async function startServer() {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize vector database
    await vectorService.initialize();
    
    // Start server
    app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`);
      console.log(`📁 Upload folder: ${path.join(__dirname, config.uploadDir)}`);
      console.log(`📄 Documents folder: ${path.join(__dirname, config.documentsDir)}`);
      console.log(`🌐 Norshin API: ${config.norshinApiUrl}`);
      console.log(`🔍 Vector DB: ${config.chromaUrl}`);
      console.log(`📊 Database: Connected`);
      console.log(`🔑 Environment: ${config.nodeEnv}`);
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
