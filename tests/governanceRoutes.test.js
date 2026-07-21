const express = require('express');
const request = require('supertest');
const { userFromClaims } = require('../middleware/auth');
const { ComplianceDecisionService, InMemoryGovernanceRepository } = require('../services/complianceDecisionService');
const { createGovernanceRouter } = require('../routes/governance');

function appWithGovernance() {
  const service = new ComplianceDecisionService(new InMemoryGovernanceRepository(), {
    clock: () => new Date('2026-01-15T12:00:00.000Z'),
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = userFromClaims({ roles: [req.get('x-test-role')], sub: req.get('x-test-user') });
    next();
  });
  app.use('/governance', createGovernanceRouter(service));
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  return app;
}

test('executes the governed decision HTTP journey with permission and SoD checks', async () => {
  const app = appWithGovernance();
  await request(app)
    .post('/governance/policies')
    .set('x-test-role', 'compliance_analyst')
    .set('x-test-user', 'analyst-1')
    .send({})
    .expect(403);

  const policyResponse = await request(app)
    .post('/governance/policies')
    .set('x-test-role', 'policy_admin')
    .set('x-test-user', 'policy-admin-1')
    .send({
      effectiveFrom: '2025-01-01T00:00:00.000Z',
      jurisdiction: 'US-FEDERAL',
      policyKey: 'FAR-RELEASE',
      rules: [{ id: 'FAR-1', description: 'Evidence required' }],
      title: 'Federal acquisition release policy',
      version: 1,
    })
    .expect(201);

  const sourceResponse = await request(app)
    .post('/governance/sources')
    .set('x-test-role', 'regulatory_ingestor')
    .set('x-test-user', 'ingestor-1')
    .send({
      authority: 'Acquisition.gov',
      content: 'Authoritative FAR text.',
      documentIdentifier: 'FAR-2025-01',
      effectiveFrom: '2025-01-01T00:00:00.000Z',
      evidenceUrl: 'https://www.acquisition.gov/far',
      jurisdiction: 'US-FEDERAL',
      retrievedAt: '2026-01-15T10:00:00.000Z',
      sourceKey: 'FAR',
      title: 'Federal Acquisition Regulation',
    })
    .expect(201);

  const policy = policyResponse.body.policy;
  const source = sourceResponse.body.source;
  const evaluationResponse = await request(app)
    .post('/governance/evaluations')
    .set('x-test-role', 'compliance_analyst')
    .set('x-test-user', 'analyst-1')
    .send({
      citations: [{ id: 'cite-1', locator: 'FAR 1.102', sourceId: source.id }],
      contractId: 'notice-1',
      deadlines: [{ citationId: 'cite-1', date: '2026-02-15T17:00:00.000Z', id: 'deadline-1' }],
      evidenceLinks: ['https://sam.gov/opp/notice-1'],
      jurisdiction: 'US-FEDERAL',
      obligations: [{ id: 'obligation-1', ownerId: 'owner-1', status: 'SATISFIED', text: 'Deadline checked' }],
      ownerId: 'owner-1',
      policyId: policy.id,
      riskRating: 'LOW',
      riskRationale: 'Authoritative evidence and the submission deadline were checked.',
      scenario: 'BID_SUBMISSION',
      sourceId: source.id,
    })
    .expect(201);
  const evaluation = evaluationResponse.body.evaluation;

  await request(app)
    .post(`/governance/evaluations/${evaluation.id}/submit`)
    .set('x-test-role', 'compliance_analyst')
    .set('x-test-user', 'analyst-1')
    .expect(200);

  await request(app)
    .post(`/governance/evaluations/${evaluation.id}/decision`)
    .set('x-test-role', 'compliance_analyst')
    .set('x-test-user', 'analyst-1')
    .send({ decision: 'APPROVED', rationale: 'Self approval must remain forbidden.' })
    .expect(403);

  const decisionResponse = await request(app)
    .post(`/governance/evaluations/${evaluation.id}/decision`)
    .set('x-test-role', 'compliance_approver')
    .set('x-test-user', 'approver-1')
    .send({ decision: 'APPROVED', rationale: 'Independent review confirms all release evidence and obligations.' })
    .expect(200);
  expect(decisionResponse.body.evaluation.status).toBe('APPROVED');

  const exportResponse = await request(app)
    .get(`/governance/evaluations/${evaluation.id}/export`)
    .set('x-test-role', 'auditor')
    .set('x-test-user', 'auditor-1')
    .expect(200);
  expect(exportResponse.body.auditEvents).toHaveLength(3);
  expect(exportResponse.body.manifestHash).toMatch(/^[a-f0-9]{64}$/);
});
