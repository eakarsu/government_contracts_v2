// Increase header size limit to 1MB at the very beginning
process.env.NODE_OPTIONS = '--max-http-header-size=1048576';

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

// Import configuration and services
const config = require('./config/env');
const { query, testConnection, disconnect } = require('./config/database');
const VectorService = require('./services/vectorService');
const vectorService = new VectorService();

// Import Prisma Client
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma Client
const prisma = new PrismaClient();

// Debug: Log that we're importing routes
console.log('📋 [DEBUG] Importing routes...');

// Import routes
const contractsRouter = require('./routes/contracts');
const documentSearchRouter = require('./routes/documentSearch');
const searchRouter = require('./routes/search');
const jobsRouter = require('./routes/jobs');
const recommendationsRouter = require('./routes/recommendations');
const rfpRouter = require('./routes/rfp');
const documentProcessingRouter = require('./routes/documentProcessing');
const parallelProcessingRouter = require('./routes/parallelProcessing');

// Import new AI-powered routes
const authRoutes = require('./routes/auth');
const semanticSearchRoutes = require('./routes/semanticSearch');
const profileRoutes = require('./routes/profiles');
const aiRfpRoutes = require('./routes/aiRfp');
const complianceRoutes = require('./routes/compliance');
const documentAnalysisRoutes = require('./routes/documentAnalysis');
const bidPredictionRoutes = require('./routes/bidPrediction');
const nlpSearchRoutes = require('./routes/nlpSearch');
const aiFeaturesRoutes = require('./routes/aiFeatures');

// Import middleware
const { rateLimiter, statusRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// CRITICAL: Set Express internal limits BEFORE any middleware
app.use((req, res, next) => {
  req.setTimeout(0); // Disable request timeout
  res.setTimeout(0); // Disable response timeout
  next();
});

// Configure Express to trust proxy headers (needed for rate limiting)
// In development, trust localhost; in production, configure specific proxy IPs
if (config.nodeEnv === 'development') {
  app.set('trust proxy', 'loopback');
} else {
  // In production, configure specific proxy IPs or use 1 for single proxy
  app.set('trust proxy', 1);
}

// Simple header logging for debugging (removed aggressive cleaning)
app.use((req, res, next) => {
  // Just log large headers for debugging
  let headerSize = 0;
  Object.keys(req.headers).forEach(key => {
    headerSize += key.length + (req.headers[key]?.toString().length || 0);
  });
  
  if (headerSize > 100000) { // Log if > 100KB
    console.log(`⚠️ Large headers detected: ${headerSize} bytes`);
  }
  
  // Set basic cache prevention headers
  res.set({
    'Cache-Control': 'no-cache, must-revalidate',
    'Expires': '0'
  });
  
  next();
});

// SIMPLIFIED CORS - similar to working server
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*'
}));
// DISABLE rate limiter completely to prevent 431 errors
// app.use(rateLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(config.uploadDir));

// Serve React build files
app.use(express.static(path.join(__dirname, 'client/build')));

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

// DISABLE ALL rate limiting to prevent 431 errors
// app.use('/api/status', statusRateLimiter);
// app.use('/api/config', statusRateLimiter);
// app.use('/api/health', statusRateLimiter);
// app.use('/api/documents/queue/status', statusRateLimiter);

// Existing routes
app.use('/api/contracts', contractsRouter);
app.use('/api/documents', documentSearchRouter);
app.use('/api/search', searchRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/recommendations', recommendationsRouter);

// Simple auth middleware that provides a default user for development
const devAuthMiddleware = (req, res, next) => {
  // In development, provide a default user
  req.user = req.user || { id: 'dev-user-1', email: 'dev@example.com' };
  next();
};

// Mount RFP routes at /api/rfp/*
app.use('/api/rfp', devAuthMiddleware, rfpRouter);

// Mount document processing routes at /api/documents/processing/*
app.use('/api/documents/processing', documentProcessingRouter);

// Mount parallel processing routes at /api/parallel/*
app.use('/api/parallel', parallelProcessingRouter);

// New AI-powered routes
app.use('/api/auth', authRoutes);
app.use('/api/ai-rfp', authMiddleware, aiRfpRoutes);
app.use('/api/bid-prediction', authMiddleware, bidPredictionRoutes);
app.use('/api/nlp', nlpSearchRoutes);
app.use('/api/ai', aiFeaturesRoutes);
app.use('/api/profiles', profileRoutes);

// Debug: Log when routers are loaded
console.log('📋 [DEBUG] Contracts router mounted at /api/contracts');
console.log('📋 [DEBUG] Document search router mounted at /api/documents');
console.log('📋 [DEBUG] Search router mounted at /api/search');
console.log('📋 [DEBUG] Jobs router mounted at /api/jobs');
console.log('📋 [DEBUG] Recommendations router mounted at /api/recommendations');
console.log('📋 [DEBUG] RFP router mounted at /api/rfp');
console.log('📋 [DEBUG] Document processing router mounted at /api/documents/processing');
console.log('📋 [DEBUG] NLP search router mounted at /api/nlp');
console.log('📋 [DEBUG] AI features router mounted at /api/ai');
console.log('📋 [DEBUG] Profiles router mounted at /api/profiles');

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

// MINIMAL test endpoint - bypasses all middleware
app.get('/test', (req, res) => {
  res.status(200).send('WORKING');
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

// Use the error handler middleware
app.use(errorHandler);

// Remove problematic host validation middleware that might cause 431 errors


// Initialize JavaScript parallel processor service (replaces queue worker)
const JSParallelProcessor = require('./services/jsParallelProcessor');
let parallelProcessor = null;

// Initialize services and start server
async function startServer() {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize vector database (non-blocking)
    await vectorService.initialize();
    
    // Initialize queue worker (but don't auto-start to prevent server blocking)
    parallelProcessor = new JSParallelProcessor({
      maxConcurrency: 10 // Process up to 10 documents concurrently
    });
    
    // JS parallel processor uses Promise.all instead of queue
    // Use the "Start Processing" button to begin parallel document processing
    console.log('🚀 [JS-PARALLEL] Initialized - use Start Processing button to begin parallel processing');
    
    // Make parallel processor accessible to routes
    app.locals.parallelProcessor = parallelProcessor;
    app.locals.queueWorker = parallelProcessor; // Keep compatibility with existing routes
    
    // Catch all handler for React routing - must be AFTER API routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
    
    // Create custom HTTP server with MASSIVE header limits to prevent 431 errors
    const server = http.createServer({
      maxHeaderSize: 1048576, // 1MB header limit - this should handle any browser headers
      keepAliveTimeout: 5000,
      headersTimeout: 6000
    }, app);
    
    // Add server error handling
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.port} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
      }
    });
    
    server.on('clientError', (err, socket) => {
      if (err.code === 'HPE_HEADER_OVERFLOW') {
        console.log('⚠️ Header overflow detected, sending 431 error');
        socket.end('HTTP/1.1 431 Request Header Fields Too Large\r\n\r\n');
      } else {
        console.log('⚠️ Client error:', err.message);
        socket.destroy();
      }
    });
    
    // Start server with custom configuration
    server.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port} with 1MB header limit`);
      console.log(`📁 Upload folder: ${path.join(__dirname, config.uploadDir)}`);
      console.log(`📄 Documents folder: ${path.join(__dirname, config.documentsDir)}`);
      console.log(`🌐 Norshin API: ${config.norshinApiUrl}`);
      console.log(`🔍 Vector DB: Vectra (Pure Node.js) ${vectorService.isConnected ? '(Connected)' : '(Disconnected)'}`);
      console.log(`📊 Database: Connected`);
      console.log(`🔑 Environment: ${config.nodeEnv}`);
      console.log(`🔄 Queue Worker: Running (maintains 10 concurrent documents for optimal performance)`);
      
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
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
startServer();

// Export vector service for routes
module.exports.vectorService = vectorService;
