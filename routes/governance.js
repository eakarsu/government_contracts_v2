const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requirePermission } = require('../middleware/auth');
const { ComplianceDecisionService, GovernanceError } = require('../services/complianceDecisionService');
const PrismaGovernanceRepository = require('../services/prismaGovernanceRepository');

function createGovernanceRouter(service) {
  const router = express.Router();

  function route(handler) {
    return async (req, res, next) => {
      try {
        await handler(req, res);
      } catch (error) {
        if (error instanceof GovernanceError) {
          return res.status(error.status).json({ code: error.code, error: error.message });
        }
        return next(error);
      }
    };
  }

  router.get('/overview', requirePermission('governance:read'), route(async (_req, res) => res.json(await service.overview())));
  router.get('/policies', requirePermission('governance:read'), route(async (_req, res) => res.json({ records: await service.listPolicies() })));
  router.get('/sources', requirePermission('governance:read'), route(async (_req, res) => res.json({ records: await service.listSources() })));
  router.get('/evaluations', requirePermission('governance:read'), route(async (_req, res) => res.json({ records: await service.listEvaluations() })));

  router.post(
    '/policies',
    requirePermission('policy:create'),
    route(async (req, res) => {
      const policy = await service.createPolicy(req.body, req.user);
      res.status(201).json({ policy });
    })
  );

  router.post(
    '/sources',
    requirePermission('source:ingest'),
    route(async (req, res) => {
      const result = await service.ingestSource(req.body, req.user);
      res.status(result.changed ? 201 : 200).json(result);
    })
  );

  router.post(
    '/evaluations',
    requirePermission('evaluation:create'),
    route(async (req, res) => {
      const evaluation = await service.createEvaluation(req.body, req.user);
      res.status(201).json({ evaluation });
    })
  );

  router.post(
    '/evaluations/:id/submit',
    requirePermission('evaluation:submit'),
    route(async (req, res) => {
      const evaluation = await service.submitEvaluation(req.params.id, req.user);
      res.json({ evaluation });
    })
  );

  router.post(
    '/evaluations/:id/decision',
    requirePermission('decision:approve'),
    route(async (req, res) => {
      const evaluation = await service.decide(req.params.id, req.body, req.user);
      res.json({ evaluation });
    })
  );

  router.post(
    '/evaluations/:id/legal-hold',
    requirePermission('legal_hold:manage'),
    route(async (req, res) => {
      const evaluation = await service.setLegalHold(req.params.id, req.body.enabled, req.body.reason, req.user);
      res.json({ evaluation });
    })
  );

  router.get(
    '/evaluations/:id/export',
    requirePermission('audit:export'),
    route(async (req, res) => {
      const auditExport = await service.exportDecision(req.params.id, req.user);
      res.set('Content-Disposition', `attachment; filename="compliance-decision-${req.params.id}.json"`);
      res.json(auditExport);
    })
  );

  return router;
}

const prisma = new PrismaClient();
const service = new ComplianceDecisionService(new PrismaGovernanceRepository(prisma));
module.exports = createGovernanceRouter(service);
module.exports.createGovernanceRouter = createGovernanceRouter;
