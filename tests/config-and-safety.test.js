const fs = require('fs');
const path = require('path');
const { loadConfig, validateForStartup } = require('../config/env');
const { assertDestructiveResetAllowed } = require('../scripts/destructiveGuard');

test('rejects weak local auth and incomplete production OIDC configuration', () => {
  expect(() =>
    validateForStartup(loadConfig({ DATABASE_URL: 'postgresql://localhost/db', JWT_SECRET: 'short' }))
  ).toThrow(/at least 32 characters/);
  expect(() => validateForStartup(loadConfig({ NODE_ENV: 'production' }))).toThrow(/DATABASE_URL is required/);
});

test('accepts complete production OIDC configuration and rejects wildcard CORS', () => {
  const environment = {
    AUTH_MODE: 'oidc',
    CORS_ORIGINS: 'https://contracts.example.gov',
    DATABASE_URL: 'postgresql://db.example.gov/contracts',
    NODE_ENV: 'production',
    OIDC_AUDIENCE: 'contracts-api',
    OIDC_ISSUER: 'https://identity.example.gov/',
    OIDC_JWKS_URI: 'https://identity.example.gov/.well-known/jwks.json',
  };
  expect(validateForStartup(loadConfig(environment)).authMode).toBe('oidc');
  expect(() => validateForStartup(loadConfig({ ...environment, CORS_ORIGINS: '*' }))).toThrow(/Wildcard/);
});

test('destructive reset requires an exact local, non-production confirmation', () => {
  const allowed = {
    ALLOW_DESTRUCTIVE_RESET: 'DELETE_LOCAL_GOVERNANCE_DATA',
    DATABASE_URL: 'postgresql://localhost/contracts',
    NODE_ENV: 'development',
  };
  expect(() => assertDestructiveResetAllowed(allowed)).not.toThrow();
  expect(() => assertDestructiveResetAllowed({ ...allowed, NODE_ENV: 'production' })).toThrow(/forbidden/);
  expect(() => assertDestructiveResetAllowed({ ...allowed, ALLOW_DESTRUCTIVE_RESET: 'yes' })).toThrow(/ALLOW_DESTRUCTIVE_RESET/);
  expect(() =>
    assertDestructiveResetAllowed({ ...allowed, DATABASE_URL: 'postgresql://production.example.gov/contracts' })
  ).toThrow(/non-local/);
});

test('repository security controls remain fail closed', () => {
  const root = path.resolve(__dirname, '..');
  const sourceFiles = [
    'config/database.js',
    'server/config/database.js',
    'middleware/auth.js',
    'routes/auth.js',
    'routes/documentProcessing.js',
    'routes/documentSearch.js',
    'docker-compose.yml',
    'services/libreoffice.service.js',
    'services/summarizationService.js',
    'start2.sh',
    'init-db.sh',
    'stop.sh',
  ];
  const source = sourceFiles.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  expect(source).not.toMatch(/rejectUnauthorized\s*:\s*false/);
  expect(source).not.toMatch(/POSTGRES_HOST_AUTH_METHOD:\s*trust/);
  expect(source).not.toMatch(/mock-jwt-token/);
  expect(source).not.toMatch(/db push --accept-data-loss/);
  expect(source).not.toMatch(/pkill -f/);
  expect(source).not.toMatch(/REACT_APP_OPENROUTER_KEY/);
  expect(fs.existsSync(path.join(root, 'github_token.txt'))).toBe(false);
  expect(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')).toContain('!**/.env.example');
});

test('fabricated legacy product routes remain disabled', () => {
  const root = path.resolve(__dirname, '..');
  for (const file of ['routes/aiRfp.js', 'routes/bidPrediction.js', 'routes/recommendations.js', 'routes/rfp.js']) {
    expect(fs.readFileSync(path.join(root, file), 'utf8')).toMatch(/status\(410\)/);
  }
  const documentSearch = fs.readFileSync(path.join(root, 'routes/documentSearch.js'), 'utf8');
  expect(documentSearch.indexOf('SIMULATED_INGESTION_DISABLED')).toBeGreaterThan(-1);
  expect(documentSearch.indexOf('SIMULATED_INGESTION_DISABLED')).toBeLessThan(
    documentSearch.indexOf('disabledSampleFetchContracts')
  );
});
