require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SAM_GOV_API_KEY',
  'REACT_APP_OPENROUTER_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // Authentication
  sessionSecret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  
  // External APIs
  samGovApiKey: process.env.SAM_GOV_API_KEY,
  norshinApiKey: process.env.NORSHIN_API_KEY,
  norshinApiUrl: process.env.NORSHIN_API_URL || 'https://norshin.com/api/process-document',
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  
  // Vector Database (Vectra - Pure Node.js)
  vectorIndexPath: process.env.VECTOR_INDEX_PATH || './vector_indexes',
  
  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
  allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '.pdf,.doc,.docx').split(','),
  
  // Directories
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  documentsDir: process.env.DOCUMENTS_DIR || './documents',
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
};

module.exports = config;
