'use strict';

const crypto = require('node:crypto');
const express = require('express');
const { prisma } = require('../config/database');
const { ROLE_PERMISSIONS, requirePermission } = require('../middleware/auth');

const router = express.Router();
const validRoles = new Set(Object.keys(ROLE_PERMISSIONS));

function cleanRoles(input) {
  const roles = [...new Set((Array.isArray(input) ? input : []).map(value => String(value).trim()).filter(Boolean))];
  if (!roles.length || roles.some(role => !validRoles.has(role))) {
    const error = new Error('At least one recognized role is required');
    error.statusCode = 400;
    throw error;
  }
  return roles;
}

function route(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (error) { res.status(error.statusCode || 500).json({ error: error.message }); }
  };
}

router.use(requirePermission('tenant:admin'));

router.get('/tenant', route(async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  return res.json({ tenant });
}));

router.patch('/tenant', route(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Tenant name is required' });
  const settings = req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : undefined;
  const tenant = await prisma.tenant.update({ where: { id: req.tenantId }, data: { name, ...(settings ? { settings } : {}) } });
  return res.json({ tenant });
}));

router.get('/memberships', route(async (_req, res) => {
  const memberships = await prisma.tenantMembership.findMany({ orderBy: [{ status: 'asc' }, { email: 'asc' }] });
  return res.json({ memberships, roles: [...validRoles].sort() });
}));

router.post('/memberships', route(async (req, res) => {
  const subject = String(req.body?.subject || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const roles = cleanRoles(req.body?.roles);
  if (!subject || !email.includes('@')) return res.status(400).json({ error: 'A trusted subject and valid email are required' });
  const membership = await prisma.tenantMembership.upsert({
    where: { tenantId_subject: { tenantId: req.tenantId, subject } },
    create: { tenantId: req.tenantId, subject, email, roles, status: 'ACTIVE' },
    update: { email, roles, status: 'ACTIVE' },
  });
  return res.status(201).json({ membership });
}));

router.patch('/memberships/:id', route(async (req, res) => {
  const membership = await prisma.tenantMembership.findUnique({ where: { id: req.params.id } });
  if (!membership) return res.status(404).json({ error: 'Membership not found' });
  const roles = req.body?.roles ? cleanRoles(req.body.roles) : undefined;
  const status = req.body?.status && ['ACTIVE', 'SUSPENDED'].includes(String(req.body.status).toUpperCase())
    ? String(req.body.status).toUpperCase()
    : undefined;
  const updated = await prisma.tenantMembership.update({ where: { id: membership.id }, data: { ...(roles ? { roles } : {}), ...(status ? { status } : {}) } });
  return res.json({ membership: updated });
}));

router.get('/secret-rotations', requirePermission('secret:rotate'), route(async (_req, res) => {
  const records = await prisma.secretRotationRecord.findMany({ orderBy: { rotatedAt: 'desc' }, take: 100 });
  return res.json({ records });
}));

router.post('/secret-rotations', requirePermission('secret:rotate'), route(async (req, res) => {
  const secretName = String(req.body?.secretName || '').trim();
  const provider = String(req.body?.provider || '').trim();
  const versionIdentifier = String(req.body?.versionIdentifier || '').trim();
  if (!secretName || !provider || !versionIdentifier) return res.status(400).json({ error: 'Secret name, provider, and non-secret version identifier are required' });
  const versionFingerprint = crypto.createHash('sha256').update(versionIdentifier).digest('hex');
  await prisma.secretRotationRecord.updateMany({ where: { secretName, status: 'ACTIVE' }, data: { status: 'ROTATED', revokedAt: new Date() } });
  const record = await prisma.secretRotationRecord.create({
    data: {
      secretName,
      provider,
      versionFingerprint,
      rotatedBy: String(req.user.email || req.user.id),
      expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : null,
      notes: req.body?.notes ? String(req.body.notes) : null,
    },
  });
  return res.status(201).json({ record });
}));

module.exports = router;
