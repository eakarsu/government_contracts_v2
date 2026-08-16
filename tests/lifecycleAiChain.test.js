'use strict';

const { ContractLifecycleService } = require('../services/contractLifecycleService');

const report = {
  summary: 'Chained lifecycle review completed.',
  executiveDecision: { recommendation: 'Continue with controls', confidence: 0.8, rationale: 'Prior and current evidence align.' },
  scenarioMetrics: [],
  riskAssessment: [{ finding: 'Approval remains open', severity: 'HIGH', evidence: 'Prior review' }],
  evidenceGaps: ['Authorized approval'],
  controls: [],
  recommendations: [{ action: 'Record approval', owner: 'Legal', priority: 'HIGH', rationale: 'Close the gate.' }],
  humanDecision: 'Legal owner must approve progression.',
};

test('lifecycle AI chains a prior same-matter report and returns structured provider metadata', async () => {
  const previous = { id: 'review-1', matterId: 'matter-1', reviewType: 'LIFECYCLE_READINESS', output: JSON.stringify({ summary: 'Initial review' }), createdAt: new Date() };
  const create = jest.fn(async ({ data }) => ({ id: 'review-2', createdAt: new Date(), ...data }));
  const auditCreate = jest.fn(async ({ data }) => data);
  const prisma = {
    contractMatter: { findUnique: jest.fn(async () => ({ id: 'matter-1', matterNumber: 'GOV-1', title: 'Cloud contract', agency: 'GSA', stage: 'DILIGENCE', clauses: [], obligations: [], amendments: [], renewals: [], riskAssessments: [] })) },
    contractAiReview: { findUnique: jest.fn(async () => previous), findFirst: jest.fn(), create },
    $transaction: async callback => callback({ contractLifecycleAuditEvent: { findFirst: jest.fn(async () => null), create: auditCreate } }),
  };
  const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ id: 'provider-2', choices: [{ message: { content: JSON.stringify(report) } }] }) }));
  const service = new ContractLifecycleService(prisma, { fetchImpl, environment: { OPENROUTER_API_KEY: 'key', OPENROUTER_MODEL: 'model', OPENROUTER_BASE_URL: 'https://provider.example' }, clock: () => new Date('2026-08-16T00:00:00Z') });
  const result = await service.aiReview('matter-1', { question: 'Continue with clauses', reviewType: 'CLAUSE_COMPLIANCE', chainPrevious: true, previousReviewId: 'review-1' }, { id: 'manager-1' });
  const providerRequest = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(providerRequest.messages[1].content).toContain('Initial review');
  expect(JSON.parse(create.mock.calls[0][0].data.output).summary).toBe(report.summary);
  expect(result.chain).toMatchObject({ chained: true, previousReviewId: 'review-1', provider: 'openrouter', providerResponseId: 'provider-2' });
  expect(result.output).toMatchObject({ summary: report.summary });
});

test('lifecycle AI rejects cross-matter chain references', async () => {
  const prisma = {
    contractMatter: { findUnique: jest.fn(async () => ({ id: 'matter-1', matterNumber: 'GOV-1', title: 'Contract', agency: 'GSA', stage: 'INTAKE', clauses: [], obligations: [], amendments: [], renewals: [], riskAssessments: [] })) },
    contractAiReview: { findUnique: jest.fn(async () => ({ id: 'review-x', matterId: 'matter-2' })) },
  };
  const service = new ContractLifecycleService(prisma, { environment: { OPENROUTER_API_KEY: 'key', OPENROUTER_MODEL: 'model', OPENROUTER_BASE_URL: 'https://provider.example' } });
  await expect(service.aiReview('matter-1', { question: 'Continue', previousReviewId: 'review-x' }, { id: 'manager-1' })).rejects.toMatchObject({ code: 'INVALID_REVIEW_CHAIN', status: 409 });
});
