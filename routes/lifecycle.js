'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { requirePermission } = require('../middleware/auth');
const { ContractLifecycleService, LifecycleError, catalogResponse } = require('../services/contractLifecycleService');

function createLifecycleRouter(service) {
  const router = express.Router();
  const route = handler => async (req, res, next) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof LifecycleError) return res.status(error.status).json({ code: error.code, error: error.message });
      if (error.code === 'P2002') return res.status(409).json({ code: 'DUPLICATE_RECORD', error: 'A lifecycle record with this key already exists' });
      return next(error);
    }
  };

  router.get('/catalog', requirePermission('lifecycle:read'), (_req, res) => res.json({ resources: catalogResponse() }));
  router.get('/overview', requirePermission('lifecycle:read'), route(async (_req, res) => res.json(await service.overview())));
  router.get('/matters/:id/export', requirePermission('lifecycle:export'), route(async (req, res) => {
    const bundle = await service.auditExport(req.params.id, req.user);
    res.set('Content-Disposition', `attachment; filename="contract-matter-${req.params.id}.json"`);
    res.json(bundle);
  }));
  router.get('/:resource', requirePermission('lifecycle:read'), route(async (req, res) => {
    const records = await service.list(req.params.resource, req.query);
    res.json({ records, total: records.length });
  }));
  router.post('/matters', requirePermission('lifecycle:create'), route(async (req, res) => res.status(201).json({ record: await service.createMatter(req.body, req.user) })));
  router.post('/matters/:id/transition', requirePermission('lifecycle:submit'), route(async (req, res) => res.json({ record: await service.transitionMatter(req.params.id, req.body, req.user) })));
  router.post('/matters/:id/approvals', requirePermission('lifecycle:approve'), route(async (req, res) => res.status(201).json({ record: await service.createApproval(req.params.id, req.body, req.user) })));
  router.post('/matters/:id/ai-review', requirePermission('lifecycle:ai'), route(async (req, res) => res.status(201).json({ record: await service.aiReview(req.params.id, req.body, req.user) })));
  router.patch('/:resource/:id', requirePermission('lifecycle:update'), route(async (req, res) => res.json({ record: await service.updateRecord(req.params.resource, req.params.id, req.body, req.user) })));
  router.delete('/:resource/:id', requirePermission('lifecycle:delete'), route(async (req, res) => res.json({ record: await service.deleteRecord(req.params.resource, req.params.id, req.user) })));
  router.post('/:resource', requirePermission('lifecycle:create'), route(async (req, res) => res.status(201).json({ record: await service.createRecord(req.params.resource, req.body, req.user) })));
  return router;
}

module.exports = createLifecycleRouter(new ContractLifecycleService(prisma));
module.exports.createLifecycleRouter = createLifecycleRouter;
