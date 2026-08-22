require('dotenv').config();

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Boolean environment values must be "true" or "false"');
}

function csv(value, fallback = []) {
  if (!value) return fallback;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function loadConfig(environment = process.env) {
  const nodeEnv = environment.NODE_ENV || 'development';
  const port = positiveInteger(environment.PORT, 5013, 'PORT');
  return {
    allowedExtensions: csv(environment.ALLOWED_EXTENSIONS, ['.pdf', '.doc', '.docx', '.txt']),
    allowedHosts: csv(environment.ALLOWED_HOSTS, ['localhost', '127.0.0.1']),
    apiBaseUrl: environment.API_BASE_URL || `http://localhost:${port}`,
    authMode: environment.AUTH_MODE || (nodeEnv === 'production' ? 'oidc' : 'local'),
    corsOrigins: csv(environment.CORS_ORIGINS, nodeEnv === 'production' ? [] : ['http://localhost:3001']),
    databaseSsl: booleanValue(environment.DATABASE_SSL, nodeEnv === 'production'),
    databaseSslCa: environment.DATABASE_SSL_CA,
    databaseUrl: environment.DATABASE_URL,
    documentsDir: environment.DOCUMENTS_DIR || './documents',
    jwtSecret: environment.JWT_SECRET,
    maxFileSize: positiveInteger(environment.MAX_FILE_SIZE, 50 * 1024 * 1024, 'MAX_FILE_SIZE'),
    nodeEnv,
    norshinApiKey: environment.NORSHIN_API_KEY,
    norshinApiUrl: environment.NORSHIN_API_URL || 'https://norshin.com/api/process-document',
    oidcAudience: environment.OIDC_AUDIENCE,
    oidcIssuer: environment.OIDC_ISSUER,
    oidcJwksUri: environment.OIDC_JWKS_URI,
    openRouterApiKey: environment.OPENROUTER_API_KEY,
    openRouterBaseUrl: environment.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    openRouterModel: environment.OPENROUTER_MODEL,
    port,
    rateLimitMaxRequests: positiveInteger(environment.RATE_LIMIT_MAX_REQUESTS, 100, 'RATE_LIMIT_MAX_REQUESTS'),
    rateLimitWindowMs: positiveInteger(environment.RATE_LIMIT_WINDOW_MS, 900000, 'RATE_LIMIT_WINDOW_MS'),
    rfpMaxTokens: positiveInteger(environment.RFP_MAX_TOKENS, 32000, 'RFP_MAX_TOKENS'),
    samGovApiKey: environment.SAM_GOV_API_KEY,
    uploadDir: environment.UPLOAD_DIR || './uploads',
    vectorIndexPath: environment.VECTOR_INDEX_PATH || './vector_indexes',
  };
}

function validateForStartup(configuration) {
  const failures = [];
  if (!configuration.databaseUrl) failures.push('DATABASE_URL is required');
  if (!['local', 'oidc'].includes(configuration.authMode)) failures.push('AUTH_MODE must be local or oidc');
  if (configuration.authMode === 'local') {
    if (configuration.nodeEnv === 'production') failures.push('AUTH_MODE=local is forbidden in production');
    if (!configuration.jwtSecret || configuration.jwtSecret.length < 32) {
      failures.push('JWT_SECRET must contain at least 32 characters for local development auth');
    }
  }
  if (configuration.authMode === 'oidc') {
    for (const [name, value] of [
      ['OIDC_ISSUER', configuration.oidcIssuer],
      ['OIDC_AUDIENCE', configuration.oidcAudience],
      ['OIDC_JWKS_URI', configuration.oidcJwksUri],
    ]) {
      if (!value) failures.push(`${name} is required for OIDC auth`);
    }
  }
  if (configuration.nodeEnv === 'production' && configuration.corsOrigins.length === 0) {
    failures.push('CORS_ORIGINS must contain at least one explicit production origin');
  }
  if (configuration.corsOrigins.includes('*')) failures.push('Wildcard CORS origins are forbidden');
  if (failures.length) throw new Error(`Invalid configuration:\n- ${failures.join('\n- ')}`);
  return configuration;
}

const config = loadConfig();
module.exports = Object.assign(config, { loadConfig, validateForStartup });
