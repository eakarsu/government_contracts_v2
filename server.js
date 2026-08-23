const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const helmet = require('helmet');

// Import configuration and services
const config = require('./config/env');
const { query, testConnection, disconnect } = require('./config/database');
const vectorService = require('./services/vectorServiceInstance');

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
const governanceRoutes = require('./routes/governance');
const runtimeAiRoutes = require('./routes/runtimeAi');
const lifecycleRoutes = require('./routes/lifecycle');
const contractSuiteRoutes = require('./routes/contractSuite');
const operationsRoutes = require('./routes/operations');
const { PipelineReliabilityService } = require('./services/pipelineReliabilityService');

// Import middleware
const { rateLimiter, authRateLimiter, statusRateLimiter, aiRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware, requirePermission } = require('./middleware/auth');

const app = express();
const pipelineReliabilityService = new PipelineReliabilityService(prisma);
let pipelineMaintenanceTimer;
const clientBuildPath = path.join(__dirname, 'client', 'build');

// Configure Express to trust proxy headers (needed for rate limiting)
// In development, trust localhost; in production, configure specific proxy IPs
if (config.nodeEnv === 'development') {
  app.set('trust proxy', 'loopback');
} else {
  // In production, configure specific proxy IPs or use 1 for single proxy
  app.set('trust proxy', 1);
}

// Reject untrusted Host headers before routing.
app.use((req, res, next) => {
  if (!config.allowedHosts.includes(req.hostname)) return res.status(400).send('Invalid Host header');
  return next();
});

// Browser access is restricted to explicit origins; non-browser clients without
// an Origin header are handled by bearer authentication below.
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin is not allowed'));
    },
  })
);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Keep static application assets out of API rate-limit buckets. Dashboard
// polling has a separate, short-window allowance, while login and generative
// AI routes retain stricter protection.
app.use('/api/status', statusRateLimiter);
app.use('/api/config', statusRateLimiter);
app.use('/api/health', statusRateLimiter);
app.use('/api/documents/queue/status', statusRateLimiter);
app.use('/api/jobs', statusRateLimiter);
app.use('/api/ai/health', statusRateLimiter);
app.use('/api/ai/opportunity-predictions', statusRateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/ai', aiRateLimiter);
app.use('/api/rfp/generate', aiRateLimiter);
app.use('/api', rateLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
if (fs.existsSync(clientBuildPath)) app.use(express.static(clientBuildPath));

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

// OIDC discovery and disabled legacy-login responses are public. Every other
// API route is authenticated except GET /api/health.
app.use('/api/auth', authRoutes);
app.use('/api', authMiddleware);
app.use('/api', (req, res, next) => {
  if (
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    || req.path.startsWith('/governance')
    || req.path.startsWith('/lifecycle')
    || req.path.startsWith('/rfp')
    || req.path === '/ai/win-probability'
  ) return next();
  return requirePermission('legacy:write')(req, res, next);
});

// Existing routes
app.use('/api/contracts', contractsRouter);
app.use('/api/documents', documentSearchRouter);
app.use('/api/search', searchRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/recommendations', recommendationsRouter);

// Mount RFP routes at /api/rfp/*
app.use('/api/rfp', rfpRouter);

// Mount document processing routes at /api/documents/processing/*
app.use('/api/documents/processing', documentProcessingRouter);

// New AI-powered routes
app.use('/api/ai-rfp', authMiddleware, aiRfpRoutes);
app.use('/api/bid-prediction', authMiddleware, bidPredictionRoutes);
app.use('/api/nlp', nlpSearchRoutes);
app.use('/api/ai', aiFeaturesRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/runtime-ai', runtimeAiRoutes);
app.use('/api/lifecycle', lifecycleRoutes);
app.use('/api/contract-suite', contractSuiteRoutes);
app.use('/api/operations', operationsRoutes);

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
  const builtClientIndex = path.join(clientBuildPath, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const indexPath = fs.existsSync(builtClientIndex) ? builtClientIndex : publicIndex;
  
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
      vectorDatabase: vectorService.isConnected
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
    vectorDB: vectorService.isConnected ? 'local-index-connected' : 'local-index-disconnected'
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
    const documentsDir = path.resolve(config.documentsDir);
    
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

// Serve the React application for client-side routes in packaged deployments.
// Unknown API routes remain JSON 404s instead of returning HTML.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (!fs.existsSync(indexPath)) return next();
  return res.sendFile(indexPath);
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

// Initialize services and start server
async function startServer() {
  try {
    config.validateForStartup(config);
    // Test database connection
    await testConnection();
    await pipelineReliabilityService.maintain();
    
    // Initialize vector database (non-blocking)
    await vectorService.initialize();
    
    // Start server
    app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`);
      console.log(`📁 Upload folder: ${path.resolve(config.uploadDir)}`);
      console.log(`📄 Documents folder: ${path.resolve(config.documentsDir)}`);
      console.log(`🌐 Norshin API: ${config.norshinApiUrl}`);
      console.log(`🔍 Vector index: ${vectorService.isConnected ? 'Connected' : 'Disconnected'}`);
      console.log(`📊 Database: Connected`);
      console.log(`🔑 Environment: ${config.nodeEnv}`);
      
      if (!vectorService.isConnected) {
        console.log('');
        console.log('💡 Vector search is using pure Node.js implementation');
        console.log('   No external dependencies required!');
      }
    });
    pipelineMaintenanceTimer = setInterval(() => {
      pipelineReliabilityService.maintain().catch(error => {
        console.error(`Pipeline maintenance failed: ${error.message}`);
      });
    }, config.pipelineMaintenanceIntervalMs);
    pipelineMaintenanceTimer.unref();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (pipelineMaintenanceTimer) clearInterval(pipelineMaintenanceTimer);
  await disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

// Start only when invoked as the application entry point, not when imported by tests.
if (require.main === module) startServer();

// Export vector service for routes
module.exports.vectorService = vectorService;
module.exports.app = app;
module.exports.startServer = startServer;
