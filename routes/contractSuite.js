'use strict';

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requirePermission } = require('../middleware/auth');
const { ContractLifecycleService } = require('../services/contractLifecycleService');
const { ContractSuiteService, ContractSuiteError, catalogResponse } = require('../services/contractSuiteService');

function createContractSuiteRouter(service) {
  const router = express.Router();
  const route = handler => async (req, res, next) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof ContractSuiteError) return res.status(error.status).json({ code: error.code, error: error.message });
      if (error.code === 'P2002') return res.status(409).json({ code: 'DUPLICATE_RECORD', error: 'This source record is already consolidated' });
      return next(error);
    }
  };

  router.get('/catalog', requirePermission('lifecycle:read'), (_req, res) => res.json(catalogResponse()));
  router.get('/overview', requirePermission('lifecycle:read'), route(async (_req, res) => res.json(await service.overview())));
  router.get('/work-items', requirePermission('lifecycle:read'), route(async (req, res) => {
    const records = await service.list(req.query);
    res.json({ records, total: records.length });
  }));
  router.get('/work-items/:id', requirePermission('lifecycle:read'), route(async (req, res) => res.json({ record: await service.get(req.params.id) })));
  router.post('/work-items', requirePermission('lifecycle:create'), route(async (req, res) => res.status(201).json({ record: await service.create(req.body, req.user) })));
  router.patch('/work-items/:id', requirePermission('lifecycle:update'), route(async (req, res) => res.json({ record: await service.update(req.params.id, req.body, req.user) })));
  router.delete('/work-items/:id', requirePermission('lifecycle:delete'), route(async (req, res) => res.json({ record: await service.delete(req.params.id, req.user) })));
  router.post('/work-items/:id/archive', requirePermission('lifecycle:update'), route(async (req, res) => res.json({ record: await service.archive(req.params.id, req.user) })));
  router.post('/work-items/:id/restore', requirePermission('lifecycle:update'), route(async (req, res) => res.json({ record: await service.restore(req.params.id, req.user) })));
  router.post('/work-items/:id/transition', requirePermission('lifecycle:submit'), route(async (req, res) => res.json({ record: await service.transition(req.params.id, req.body, req.user) })));
  router.post('/work-items/:id/ai-review', requirePermission('lifecycle:ai'), route(async (req, res) => res.status(201).json({ record: await service.aiReview(req.params.id, req.body, req.user) })));
  return router;
}

const prisma = new PrismaClient();
const lifecycle = new ContractLifecycleService(prisma);
module.exports = createContractSuiteRouter(new ContractSuiteService(prisma, { lifecycleAudit: lifecycle.audit.bind(lifecycle) }));
module.exports.createContractSuiteRouter = createContractSuiteRouter;
