'use strict';

const express = require('express');
const request = require('supertest');
const { userFromClaims } = require('../middleware/auth');
const { createContractSuiteRouter } = require('../routes/contractSuite');
const { catalogResponse, parseStructuredOutput, ContractSuiteError, ContractSuiteService } = require('../services/contractSuiteService');

function appWithSuite() {
  const service = {
    overview: jest.fn(async () => ({ total: 80, highRisk: 20, domains: { ACQUISITION: 16 } })),
    list: jest.fn(async () => [{ id: 'work-1', domain: 'NEGOTIATION', capability: 'redline-review' }]),
    get: jest.fn(async id => ({ id, analyses: [] })),
    create: jest.fn(async (input, actor) => ({ id: 'work-2', ownerId: actor.id, ...input })),
    transition: jest.fn(async (_id, input, actor) => ({ id: 'work-1', status: input.nextStatus, approvedBy: actor.id })),
    aiReview: jest.fn(async () => ({ id: 'analysis-1', advisoryOnly: true, status: 'PENDING_HUMAN_REVIEW' })),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = userFromClaims({ roles: [req.get('x-test-role')], sub: req.get('x-test-user') }); next(); });
  app.use('/contract-suite', createContractSuiteRouter(service));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  return { app, service };
}

test('exposes deduplicated catalog, overview, and domain records', async () => {
  const { app, service } = appWithSuite();
  const catalog = await request(app).get('/contract-suite/catalog').set('x-test-role', 'contract_viewer').set('x-test-user', 'viewer-1').expect(200);
  expect(catalog.body.domains).toHaveLength(5);
  expect(catalog.body.sources.find(source => source.project === 'smart-contract-work').disposition).toBe('EXCLUDED_QUARANTINE');
  await request(app).get('/contract-suite/overview').set('x-test-role', 'auditor').set('x-test-user', 'auditor-1').expect(200);
  const records = await request(app).get('/contract-suite/work-items?domain=negotiation').set('x-test-role', 'contract_viewer').set('x-test-user', 'viewer-1').expect(200);
  expect(records.body.total).toBe(1);
  expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ domain: 'negotiation' }));
});

test('enforces governed write and AI permissions', async () => {
  const { app } = appWithSuite();
  await request(app).post('/contract-suite/work-items').set('x-test-role', 'contract_viewer').set('x-test-user', 'viewer-1').send({}).expect(403);
  await request(app).post('/contract-suite/work-items').set('x-test-role', 'contract_manager').set('x-test-user', 'manager-1').send({ domain: 'negotiation' }).expect(201);
  await request(app).post('/contract-suite/work-items/work-1/transition').set('x-test-role', 'contract_manager').set('x-test-user', 'manager-1').send({ nextStatus: 'IN_REVIEW', rationale: 'Evidence reviewed' }).expect(200);
  const review = await request(app).post('/contract-suite/work-items/work-1/ai-review').set('x-test-role', 'contract_manager').set('x-test-user', 'manager-1').send({ question: 'Assess risks' }).expect(201);
  expect(review.body.record.advisoryOnly).toBe(true);
});

test('catalog capability keys are unique within each domain', () => {
  for (const domain of catalogResponse().domains) {
    const keys = domain.capabilities.map(capability => capability.key);
    expect(new Set(keys).size).toBe(keys.length);
  }
});

test('structured AI reports reject raw or incomplete output', () => {
  const valid = parseStructuredOutput('```json\n{"summary":"Ready","riskAssessment":[],"evidenceGaps":[],"recommendations":[],"humanDecision":"Counsel review"}\n```');
  expect(valid.humanDecision).toBe('Counsel review');
  expect(() => parseStructuredOutput('{"summary":"Incomplete"}')).toThrow(ContractSuiteError);
  expect(() => parseStructuredOutput('not json')).toThrow(ContractSuiteError);
});

test('service refuses records attributed to the quarantined archive', async () => {
  const service = new ContractSuiteService({});
  await expect(service.create({ domain: 'smart-contract', capability: 'source-audit', sourceProject: 'smart-contract-work' }, { id: 'manager-1' }))
    .rejects.toMatchObject({ code: 'QUARANTINED_SOURCE', status: 409 });
});
