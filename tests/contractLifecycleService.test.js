const fs = require('node:fs');
const path = require('node:path');
const { LIFECYCLE_STAGES, RESOURCE_CATALOG, assertTransition, catalogResponse, digest } = require('../services/contractLifecycleService');

test('defines the complete governed contract lifecycle catalog', () => {
  expect(LIFECYCLE_STAGES).toEqual(['INTAKE', 'DILIGENCE', 'NEGOTIATION', 'APPROVAL', 'EXECUTION', 'PERFORMANCE', 'RENEWAL', 'CLOSEOUT']);
  expect(Object.keys(RESOURCE_CATALOG)).toEqual(expect.arrayContaining([
    'matters', 'parties', 'document-versions', 'clauses', 'obligations', 'milestones', 'amendments',
    'approvals', 'renewals', 'risk-assessments', 'templates', 'ai-reviews', 'integrations',
  ]));
  expect(catalogResponse().every(item => item.label && item.description)).toBe(true);
});

test('allows only adjacent lifecycle stage transitions', () => {
  expect(assertTransition('INTAKE', 'DILIGENCE')).toBe('DILIGENCE');
  expect(assertTransition('APPROVAL', 'EXECUTION')).toBe('EXECUTION');
  expect(() => assertTransition('INTAKE', 'EXECUTION')).toThrow(/cannot transition/);
  expect(() => assertTransition('PERFORMANCE', 'NEGOTIATION')).toThrow(/cannot transition/);
});

test('creates deterministic evidence digests', () => {
  expect(digest({ b: 2, a: 1 })).toBe(digest({ a: 1, b: 2 }));
  expect(digest({ evidence: 'contract' })).toMatch(/^[a-f0-9]{64}$/);
});

test('lifecycle migration is additive and protects evidence tables', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'migrations', '20260815090000_contract_lifecycle', 'migration.sql'), 'utf8');
  expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\b/i);
  expect(migration).toMatch(/contract_document_version_append_only/);
  expect(migration).toMatch(/contract_approval_append_only/);
  expect(migration).toMatch(/contract_lifecycle_audit_append_only/);
});

test('lifecycle seed is non-destructive and enforces sixteen records', () => {
  const seed = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seed-contract-lifecycle.js'), 'utf8');
  expect(seed).not.toMatch(/\b(?:deleteMany|DROP|TRUNCATE)\b/i);
  expect(seed).toMatch(/const MINIMUM = 16/);
  expect(seed).toMatch(/expected at least \$\{MINIMUM\}/);
});
