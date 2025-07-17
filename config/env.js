require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 5013,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5013}`,
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/government_contracts',
  
  // Authentication
  sessionSecret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  
  // External APIs
  samGovApiKey: process.env.SAM_GOV_API_KEY,
  norshinApiKey: process.env.NORSHIN_API_KEY,
  norshinApiUrl: process.env.NORSHIN_API_URL || 'https://norshin.com/api/process-document',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENROUTER_KEY,
  
  // Vector Database (Vectra - Pure Node.js)
  vectorIndexPath: process.env.VECTOR_INDEX_PATH || './vector_indexes',
  
  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
  allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '.pdf,.doc,.docx,.txt').split(','),
  
  // Directories
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  documentsDir: process.env.DOCUMENTS_DIR || './documents',
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
};

// Validate critical environment variables in production
if (config.nodeEnv === 'production') {
  const requiredEnvVars = ['DATABASE_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please check your .env file');
    process.exit(1);
  }
}

// Log configuration status
console.log('🔧 Configuration loaded:');
console.log(`   - Environment: ${config.nodeEnv}`);
console.log(`   - Port: ${config.port}`);
console.log(`   - Database: ${config.databaseUrl ? '✅ Configured' : '❌ Missing'}`);
console.log(`   - OpenRouter API: ${config.openRouterApiKey ? '✅ Configured' : '❌ Missing'}`);
console.log(`   - SAM.gov API: ${config.samGovApiKey ? '✅ Configured' : '❌ Missing'}`);

module.exports = config;
