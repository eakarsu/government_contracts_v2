'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { requirePermission } = require('../middleware/auth');
const { GovernmentEnrichmentService } = require('../services/governmentEnrichmentService');

const router = express.Router();
const enrichment = new GovernmentEnrichmentService({ prisma });
const route = handler => async (req, res) => { try { await handler(req, res); } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }); } };

router.get('/company-profiles/:id', requirePermission('rfp:read'), route(async (req, res) => {
  const records = await prisma.companyEnrichment.findMany({ where: { companyProfileId: Number(req.params.id) }, orderBy: { retrievedAt: 'desc' } });
  res.json({ records, sourcePolicy: { SAM_ENTITY_PUBLIC: 'Public entity registration evidence', USASPENDING_FPDS: 'Public award history evidence', SBA: 'Reviewed dataset import only', CPARS: 'Authorized integration only' } });
}));

router.post('/company-profiles/:id/capture', requirePermission('enrichment:write'), route(async (req, res) => {
  const record = await enrichment.capture(req.params.id, String(req.body?.source || '').toUpperCase(), req.body?.identifier, req.user);
  res.status(201).json({ record, warning: 'Source evidence is captured but must be reviewed before it becomes a verified company claim.' });
}));

router.patch('/:id/review', requirePermission('enrichment:write'), route(async (req, res) => {
  const status = String(req.body?.status || '').toUpperCase();
  if (!['VERIFIED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Status must be VERIFIED or REJECTED' });
  const existing = await prisma.companyEnrichment.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Enrichment record not found' });
  res.json({ record: await prisma.companyEnrichment.update({ where: { id: existing.id }, data: { status } }) });
}));

module.exports = router;
