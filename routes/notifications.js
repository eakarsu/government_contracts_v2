'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { requirePermission } = require('../middleware/auth');
const { CHANNELS, EVENT_TYPES, NotificationService, encrypt } = require('../services/notificationService');

const router = express.Router();
const notifications = new NotificationService({ prisma });

function actor(req) { return String(req.user.email || req.user.id); }
function route(handler) { return async (req, res) => { try { await handler(req, res); } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }); } }; }
router.use(requirePermission('notification:manage'));

router.get('/saved-searches', route(async (req, res) => {
  const savedSearches = await prisma.savedSearch.findMany({ where: { ownerId: actor(req) }, orderBy: { updatedAt: 'desc' } });
  res.json({ savedSearches });
}));

router.post('/saved-searches', route(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const query = req.body?.query;
  const cadence = String(req.body?.cadence || 'DAILY').toUpperCase();
  if (!name || !query || typeof query !== 'object' || !['REALTIME', 'DAILY', 'WEEKLY'].includes(cadence)) throw new Error('Name, query, and a valid cadence are required');
  const savedSearch = await prisma.savedSearch.upsert({
    where: { tenantId_ownerId_name: { tenantId: req.tenantId, ownerId: actor(req), name } },
    create: { ownerId: actor(req), name, query, cadence },
    update: { query, cadence, enabled: true },
  });
  res.status(201).json({ savedSearch });
}));

router.patch('/saved-searches/:id', route(async (req, res) => {
  const record = await prisma.savedSearch.findFirst({ where: { id: req.params.id, ownerId: actor(req) } });
  if (!record) return res.status(404).json({ error: 'Saved search not found' });
  const savedSearch = await prisma.savedSearch.update({ where: { id: record.id }, data: { enabled: Boolean(req.body.enabled), ...(req.body.cadence ? { cadence: String(req.body.cadence).toUpperCase() } : {}) } });
  res.json({ savedSearch });
}));

router.get('/subscriptions', route(async (req, res) => {
  const records = await prisma.notificationSubscription.findMany({ where: { ownerId: actor(req) }, orderBy: { updatedAt: 'desc' } });
  res.json({ subscriptions: records.map(({ encryptedDestination, ...record }) => ({ ...record, destinationConfigured: Boolean(encryptedDestination) })), channels: [...CHANNELS], eventTypes: [...EVENT_TYPES] });
}));

router.post('/subscriptions', route(async (req, res) => {
  const channel = String(req.body?.channel || 'IN_APP').toUpperCase();
  const eventTypes = [...new Set((req.body?.eventTypes || []).map(value => String(value).toUpperCase()))];
  const destination = String(req.body?.destination || '').trim();
  if (!CHANNELS.has(channel) || !eventTypes.length || eventTypes.some(type => !EVENT_TYPES.has(type))) throw new Error('A supported channel and event types are required');
  if (channel !== 'IN_APP' && !destination) throw new Error('Destination is required for external channels');
  if (['EMAIL', 'CALENDAR'].includes(channel) && !/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(destination)) throw new Error('A valid notification email address is required');
  if (['SLACK', 'TEAMS'].includes(channel)) {
    let url; try { url = new URL(destination); } catch { throw new Error('A valid HTTPS webhook URL is required'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('A valid HTTPS webhook URL without embedded credentials is required');
  }
  const subscription = await prisma.notificationSubscription.create({
    data: { ownerId: actor(req), channel, eventTypes, encryptedDestination: destination ? encrypt(destination) : null },
  });
  const { encryptedDestination, ...safe } = subscription;
  res.status(201).json({ subscription: { ...safe, destinationConfigured: Boolean(encryptedDestination) } });
}));

router.patch('/subscriptions/:id', route(async (req, res) => {
  const record = await prisma.notificationSubscription.findFirst({ where: { id: req.params.id, ownerId: actor(req) } });
  if (!record) return res.status(404).json({ error: 'Subscription not found' });
  const subscription = await prisma.notificationSubscription.update({ where: { id: record.id }, data: { enabled: Boolean(req.body.enabled) } });
  const { encryptedDestination, ...safe } = subscription;
  res.json({ subscription: { ...safe, destinationConfigured: Boolean(encryptedDestination) } });
}));

router.get('/events', route(async (req, res) => {
  const events = await prisma.notificationEvent.findMany({ where: { ownerId: actor(req) }, orderBy: { createdAt: 'desc' }, take: Math.min(200, Number(req.query.limit) || 50) });
  res.json({ events });
}));

router.patch('/events/:id/read', route(async (req, res) => {
  const record = await prisma.notificationEvent.findFirst({ where: { id: req.params.id, ownerId: actor(req) } });
  if (!record) return res.status(404).json({ error: 'Notification not found' });
  res.json({ event: await prisma.notificationEvent.update({ where: { id: record.id }, data: { readAt: new Date() } }) });
}));

router.post('/test', route(async (req, res) => {
  const events = await notifications.emit({ tenantId: req.tenantId, ownerId: actor(req), eventType: 'SUBMISSION_STATUS', subject: 'GovContract AI notification test', payload: { message: 'Your notification channel is configured.' } });
  res.status(202).json({ queued: events.length });
}));

module.exports = router;
