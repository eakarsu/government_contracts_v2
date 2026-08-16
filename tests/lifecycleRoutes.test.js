const express = require('express');
const request = require('supertest');
const { userFromClaims } = require('../middleware/auth');
const { createLifecycleRouter } = require('../routes/lifecycle');

function appWithLifecycle() {
  const service = {
    overview: jest.fn(async () => ({ counts: { matters: 16 }, metrics: { activeMatters: 14 } })),
    list: jest.fn(async () => [{ id: 'matter-1', matterNumber: 'GOV-001' }]),
    createMatter: jest.fn(async input => ({ id: 'matter-2', ...input })),
    transitionMatter: jest.fn(async (_id, input) => ({ id: 'matter-1', stage: input.nextStage })),
    createApproval: jest.fn(async (_id, input, actor) => ({ id: 'approval-1', actorId: actor.id, ...input })),
    aiReview: jest.fn(async () => ({ id: 'review-1', advisoryOnly: true })),
    createRecord: jest.fn(async (_resource, input) => ({ id: 'record-1', ...input })),
    auditExport: jest.fn(async () => ({ manifestHash: 'a'.repeat(64) })),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = userFromClaims({ roles: [req.get('x-test-role')], sub: req.get('x-test-user') }); next(); });
  app.use('/lifecycle', createLifecycleRouter(service));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  return { app, service };
}

test('exposes lifecycle catalog, overview, and records to governed readers', async () => {
  const { app } = appWithLifecycle();
  await request(app).get('/lifecycle/catalog').set('x-test-role', 'contract_viewer').set('x-test-user', 'viewer-1').expect(200);
  await request(app).get('/lifecycle/overview').set('x-test-role', 'auditor').set('x-test-user', 'auditor-1').expect(200);
  const response = await request(app).get('/lifecycle/matters').set('x-test-role', 'contract_viewer').set('x-test-user', 'viewer-1').expect(200);
  expect(response.body.total).toBe(1);
});

test('enforces create, approval, AI, and export permissions', async () => {
  const { app } = appWithLifecycle();
  await request(app).post('/lifecycle/matters').set('x-test-role', 'contract_viewer').set('x-test-user', 'viewer-1').send({}).expect(403);
  await request(app).post('/lifecycle/matters').set('x-test-role', 'contract_manager').set('x-test-user', 'manager-1').send({ matterNumber: 'GOV-002' }).expect(201);
  await request(app).post('/lifecycle/matters/matter-1/approvals').set('x-test-role', 'legal_reviewer').set('x-test-user', 'legal-1').send({ decision: 'APPROVED', step: 'LEGAL' }).expect(201);
  await request(app).post('/lifecycle/matters/matter-1/ai-review').set('x-test-role', 'contract_manager').set('x-test-user', 'manager-1').send({ question: 'Review readiness' }).expect(201);
  await request(app).get('/lifecycle/matters/matter-1/export').set('x-test-role', 'auditor').set('x-test-user', 'auditor-1').expect(200);
});
