const { applyTenantScope } = require('../services/tenantContext');
const { createProductionSurfaceMiddleware } = require('../middleware/productionSurface');
const { decrypt, encrypt, opportunityMatches } = require('../services/notificationService');
const { validFileName } = require('../services/submissionPackageService');
const { scanFile } = require('../services/malwareScanner');

test('tenant scope is added to tenant-owned reads and writes', () => {
  expect(applyTenantScope({ model: 'RfpResponse', action: 'findMany', args: { where: { status: 'draft' } } }, 'tenant-a').args.where).toEqual({ status: 'draft', tenantId: 'tenant-a' });
  expect(applyTenantScope({ model: 'CompanyProfile', action: 'create', args: { data: { companyName: 'A' } } }, 'tenant-a').args.data).toEqual({ companyName: 'A', tenantId: 'tenant-a' });
  expect(applyTenantScope({ model: 'Contract', action: 'findMany', args: {} }, 'tenant-a').args.where).toBeUndefined();
});

test('production surface hides test endpoints but preserves ordinary routes', () => {
  const middleware = createProductionSurfaceMiddleware({ enableTestEndpoints: false });
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  middleware({ method: 'POST', path: '/documents/queue/process-test' }, response, next);
  expect(response.status).toHaveBeenCalledWith(404);
  middleware({ method: 'POST', path: '/documents/queue/process' }, response, next);
  expect(next).toHaveBeenCalled();
});

test('notification destinations round trip through authenticated encryption', () => {
  const configuration = { dataEncryptionKey: 'test-only-encryption-key-with-more-than-32-characters' };
  const encrypted = encrypt('https://hooks.example.test/secret', configuration);
  expect(encrypted).not.toContain('hooks.example');
  expect(decrypt(encrypted, configuration)).toBe('https://hooks.example.test/secret');
});

test('saved search matching and package filenames are conservative', () => {
  const contract = { title: 'Cloud data platform', description: 'Secure engineering', agency: 'Department of Energy', naicsCode: '541512' };
  expect(opportunityMatches(contract, { keyword: 'cloud', agency: 'energy', naicsCode: '5415' })).toBe(true);
  expect(opportunityMatches(contract, { keyword: 'landscaping' })).toBe(false);
  expect(validFileName('Volume_1-Technical.pdf')).toBe(true);
  expect(validFileName('../proposal.pdf')).toBe(false);
});

test('development can explicitly disable malware scanning', async () => {
  await expect(scanFile('/not/read/in/disabled/mode', { malwareScanMode: 'disabled' })).resolves.toMatchObject({ status: 'SKIPPED' });
});
