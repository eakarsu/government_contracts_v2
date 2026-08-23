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

function enumValue(value, fallback, allowed, name) {
  const selected = value || fallback;
  if (!allowed.includes(selected)) throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  return selected;
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
    defaultTenantId: environment.DEFAULT_TENANT_ID || 'default',
    documentsDir: environment.DOCUMENTS_DIR || './documents',
    jwtSecret: environment.JWT_SECRET,
    enableTestEndpoints: booleanValue(environment.ENABLE_TEST_ENDPOINTS, nodeEnv !== 'production'),
    featureSportsContracts: booleanValue(environment.FEATURE_SPORTS_CONTRACTS, nodeEnv !== 'production'),
    featureSmartContractAssurance: booleanValue(environment.FEATURE_SMART_CONTRACT_ASSURANCE, nodeEnv !== 'production'),
    maxFileSize: positiveInteger(environment.MAX_FILE_SIZE, 50 * 1024 * 1024, 'MAX_FILE_SIZE'),
    nodeEnv,
    norshinApiKey: environment.NORSHIN_API_KEY,
    norshinApiUrl: environment.NORSHIN_API_URL || 'https://norshin.com/api/process-document',
    oidcAudience: environment.OIDC_AUDIENCE,
    oidcAuthorizationEndpoint: environment.OIDC_AUTHORIZATION_ENDPOINT || (environment.OIDC_ISSUER ? `${environment.OIDC_ISSUER.replace(/\/$/, '')}/authorize` : undefined),
    oidcClientId: environment.OIDC_CLIENT_ID,
    oidcIssuer: environment.OIDC_ISSUER,
    oidcJwksUri: environment.OIDC_JWKS_URI,
    oidcTenantClaim: environment.OIDC_TENANT_CLAIM || 'tenant_id',
    oidcScopes: environment.OIDC_SCOPES || 'openid profile email',
    oidcTokenEndpoint: environment.OIDC_TOKEN_ENDPOINT || (environment.OIDC_ISSUER ? `${environment.OIDC_ISSUER.replace(/\/$/, '')}/oauth/token` : undefined),
    pipelineExecutionMode: enumValue(environment.PIPELINE_EXECUTION_MODE, nodeEnv === 'production' ? 'durable' : 'inline', ['inline', 'durable'], 'PIPELINE_EXECUTION_MODE'),
    workerLeaseMs: positiveInteger(environment.WORKER_LEASE_MS, 15 * 60 * 1000, 'WORKER_LEASE_MS'),
    workerPollMs: positiveInteger(environment.WORKER_POLL_MS, 2000, 'WORKER_POLL_MS'),
    workerConcurrency: positiveInteger(environment.WORKER_CONCURRENCY, 1, 'WORKER_CONCURRENCY'),
    malwareScanMode: enumValue(environment.MALWARE_SCAN_MODE, nodeEnv === 'production' ? 'required' : 'disabled', ['disabled', 'audit', 'required'], 'MALWARE_SCAN_MODE'),
    malwareScannerCommand: environment.MALWARE_SCANNER_COMMAND || 'clamscan',
    storageProvider: enumValue(environment.DOCUMENT_STORAGE_PROVIDER, 'filesystem', ['filesystem', 's3'], 'DOCUMENT_STORAGE_PROVIDER'),
    s3Endpoint: environment.S3_ENDPOINT,
    s3Region: environment.S3_REGION || 'us-east-1',
    s3Bucket: environment.S3_BUCKET,
    s3AccessKeyId: environment.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: environment.S3_SECRET_ACCESS_KEY,
    s3KmsKeyId: environment.S3_KMS_KEY_ID,
    s3RetentionDays: positiveInteger(environment.S3_RETENTION_DAYS, 90, 'S3_RETENTION_DAYS'),
    s3ForcePathStyle: booleanValue(environment.S3_FORCE_PATH_STYLE, true),
    dataEncryptionKey: environment.DATA_ENCRYPTION_KEY,
    smtpUrl: environment.SMTP_URL,
    notificationFrom: environment.NOTIFICATION_FROM,
    monitoringToken: environment.MONITORING_TOKEN,
    sentryDsn: environment.SENTRY_DSN,
    sentryTracesSampleRate: Number(environment.SENTRY_TRACES_SAMPLE_RATE || 0),
    openRouterApiKey: environment.OPENROUTER_API_KEY,
    openRouterBaseUrl: environment.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    openRouterModel: environment.OPENROUTER_MODEL,
    port,
    rateLimitMaxRequests: positiveInteger(environment.RATE_LIMIT_MAX_REQUESTS, 600, 'RATE_LIMIT_MAX_REQUESTS'),
    rateLimitWindowMs: positiveInteger(environment.RATE_LIMIT_WINDOW_MS, 900000, 'RATE_LIMIT_WINDOW_MS'),
    aiRateLimitMaxRequests: positiveInteger(environment.AI_RATE_LIMIT_MAX_REQUESTS, 10, 'AI_RATE_LIMIT_MAX_REQUESTS'),
    statusRateLimitMaxRequests: positiveInteger(environment.STATUS_RATE_LIMIT_MAX_REQUESTS, 300, 'STATUS_RATE_LIMIT_MAX_REQUESTS'),
    submissionPackageEnforcement: enumValue(environment.SUBMISSION_PACKAGE_ENFORCEMENT, nodeEnv === 'production' ? 'required' : 'advisory', ['advisory', 'required'], 'SUBMISSION_PACKAGE_ENFORCEMENT'),
    tenantEnforcement: enumValue(environment.TENANT_ENFORCEMENT, nodeEnv === 'production' ? 'required' : 'compatibility', ['compatibility', 'required'], 'TENANT_ENFORCEMENT'),
    pipelineMaintenanceIntervalMs: positiveInteger(environment.PIPELINE_MAINTENANCE_INTERVAL_MS, 60000, 'PIPELINE_MAINTENANCE_INTERVAL_MS'),
    rfpMaxTokens: positiveInteger(environment.RFP_MAX_TOKENS, 64000, 'RFP_MAX_TOKENS'),
    rfpRequestTimeoutMs: positiveInteger(environment.RFP_REQUEST_TIMEOUT_MS, 600000, 'RFP_REQUEST_TIMEOUT_MS'),
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
      ['OIDC_CLIENT_ID', configuration.oidcClientId],
      ['OIDC_AUTHORIZATION_ENDPOINT', configuration.oidcAuthorizationEndpoint],
      ['OIDC_TOKEN_ENDPOINT', configuration.oidcTokenEndpoint],
    ]) {
      if (!value) failures.push(`${name} is required for OIDC auth`);
    }
  }
  if (configuration.nodeEnv === 'production' && configuration.corsOrigins.length === 0) {
    failures.push('CORS_ORIGINS must contain at least one explicit production origin');
  }
  if (configuration.nodeEnv === 'production' && configuration.enableTestEndpoints) {
    failures.push('ENABLE_TEST_ENDPOINTS=true is forbidden in production');
  }
  if (configuration.nodeEnv === 'production' && configuration.pipelineExecutionMode !== 'durable') {
    failures.push('PIPELINE_EXECUTION_MODE=durable is required in production');
  }
  if (configuration.nodeEnv === 'production' && configuration.malwareScanMode !== 'required') {
    failures.push('MALWARE_SCAN_MODE=required is required in production');
  }
  if (configuration.nodeEnv === 'production' && configuration.storageProvider !== 's3') {
    failures.push('DOCUMENT_STORAGE_PROVIDER=s3 is required in production');
  }
  if (configuration.storageProvider === 's3') {
    for (const [name, value] of [
      ['S3_ENDPOINT', configuration.s3Endpoint],
      ['S3_BUCKET', configuration.s3Bucket],
      ['S3_ACCESS_KEY_ID', configuration.s3AccessKeyId],
      ['S3_SECRET_ACCESS_KEY', configuration.s3SecretAccessKey],
    ]) {
      if (!value) failures.push(`${name} is required for S3-compatible document storage`);
    }
  }
  if (configuration.nodeEnv === 'production' && (!configuration.dataEncryptionKey || configuration.dataEncryptionKey.length < 32)) {
    failures.push('DATA_ENCRYPTION_KEY must contain at least 32 characters in production');
  }
  if (configuration.nodeEnv === 'production' && (!configuration.monitoringToken || configuration.monitoringToken.length < 24)) {
    failures.push('MONITORING_TOKEN must contain at least 24 characters in production');
  }
  if (configuration.nodeEnv === 'production' && configuration.databaseUrl) {
    try {
      const databaseName = new URL(configuration.databaseUrl).pathname.replace(/^\//, '');
      if (/(?:^|[_-])(?:test|dev|local)(?:$|[_-])/i.test(databaseName)) {
        failures.push('Production DATABASE_URL must not target a test, development, or local-named database');
      }
    } catch {
      failures.push('DATABASE_URL must be a valid PostgreSQL URL');
    }
  }
  if (configuration.corsOrigins.includes('*')) failures.push('Wildcard CORS origins are forbidden');
  if (failures.length) throw new Error(`Invalid configuration:\n- ${failures.join('\n- ')}`);
  return configuration;
}

const config = loadConfig();
module.exports = Object.assign(config, { loadConfig, validateForStartup });
