'use strict';

const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const config = require('../config/env');
const { prisma } = require('../config/database');
const { runWithTenant } = require('./tenantContext');

const CHANNELS = new Set(['IN_APP', 'EMAIL', 'SLACK', 'TEAMS', 'CALENDAR']);
const EVENT_TYPES = new Set(['NEW_OPPORTUNITY', 'AMENDMENT', 'DEADLINE', 'REVIEW_ASSIGNED', 'FAILED_JOB', 'SUBMISSION_STATUS']);

function cipherKey(configuration = config) {
  if (!configuration.dataEncryptionKey) throw new Error('DATA_ENCRYPTION_KEY is required for external notification destinations');
  return crypto.createHash('sha256').update(configuration.dataEncryptionKey).digest();
}

function encrypt(value, configuration = config) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(configuration), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
}

function decrypt(value, configuration = config) {
  const [iv, tag, ciphertext] = String(value).split('.').map(part => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(configuration), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function calendarText(event) {
  const start = new Date(event.payload?.deadline || event.scheduledAt);
  const stamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GovContract AI//EN', 'BEGIN:VEVENT', `UID:${event.id}@govcontract-ai`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `SUMMARY:${String(event.subject).replace(/[\r\n,;]/g, ' ')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

function opportunityMatches(contract, query) {
  const text = `${contract.title || ''} ${contract.description || ''} ${contract.agency || ''}`.toLowerCase();
  const keywords = Array.isArray(query.keywords) ? query.keywords : query.keyword ? [query.keyword] : [];
  if (keywords.length && !keywords.every(value => text.includes(String(value).toLowerCase()))) return false;
  if (query.agency && !String(contract.agency || '').toLowerCase().includes(String(query.agency).toLowerCase())) return false;
  if (query.naicsCode && !String(contract.naicsCode || '').startsWith(String(query.naicsCode))) return false;
  if (query.setAsideCode && String(contract.setAsideCode || '') !== String(query.setAsideCode)) return false;
  return true;
}

class NotificationService {
  constructor(options = {}) {
    this.prisma = options.prisma || prisma;
    this.config = options.config || config;
    this.transport = options.transport || (this.config.smtpUrl ? nodemailer.createTransport(this.config.smtpUrl) : null);
  }

  async emit({ tenantId, ownerId, eventType, subject, payload = {}, scheduledAt = new Date() }) {
    if (!EVENT_TYPES.has(eventType)) throw new Error('Unsupported notification event type');
    return runWithTenant(tenantId, async () => {
      const subscriptions = await this.prisma.notificationSubscription.findMany({
        where: { ownerId: String(ownerId), enabled: true, eventTypes: { has: eventType } },
      });
      const channels = subscriptions.length ? subscriptions : [{ id: null, channel: 'IN_APP' }];
      return Promise.all(channels.map(subscription => this.prisma.notificationEvent.create({
        data: { subscriptionId: subscription.id, eventType, ownerId: String(ownerId), subject, payload, channel: subscription.channel, scheduledAt },
      })));
    });
  }

  async emitToTenant({ tenantId, eventType, subject, payload = {}, scheduledAt = new Date() }) {
    const memberships = await this.prisma.tenantMembership.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { email: true } });
    const results = [];
    for (const membership of memberships) results.push(...await this.emit({ tenantId, ownerId: membership.email, eventType, subject, payload, scheduledAt }));
    return results;
  }

  async matchSavedSearches(tenantId, contracts) {
    return runWithTenant(tenantId, async () => {
      const searches = await this.prisma.savedSearch.findMany({ where: { enabled: true } });
      let created = 0;
      for (const search of searches) {
        const matches = contracts.filter(contract => opportunityMatches(contract, search.query)).slice(0, 25);
        if (!matches.length) continue;
        const subject = `${matches.length} new match${matches.length === 1 ? '' : 'es'} for saved search “${search.name}”`;
        created += (await this.emit({ tenantId, ownerId: search.ownerId, eventType: 'NEW_OPPORTUNITY', subject, payload: { savedSearchId: search.id, matches: matches.map(contract => ({ noticeId: contract.noticeId, title: contract.title, agency: contract.agency, responseDeadline: contract.responseDeadline })), message: 'Review the authoritative SAM.gov records and solicitation attachments.' } })).length;
        await this.prisma.savedSearch.update({ where: { id: search.id }, data: { lastRunAt: new Date(), nextRunAt: search.cadence === 'WEEKLY' ? new Date(Date.now() + 7 * 86400000) : new Date(Date.now() + 86400000) } });
      }
      return created;
    });
  }

  async scheduleDeadlineReminders(days = 7) {
    const now = new Date(); const end = new Date(Date.now() + days * 86400000);
    const [contracts, tenants] = await Promise.all([
      this.prisma.contract.findMany({ where: { responseDeadline: { gte: now, lte: end } }, orderBy: { responseDeadline: 'asc' }, take: 200 }),
      this.prisma.tenant.findMany({ where: { status: 'ACTIVE' }, include: { memberships: { where: { status: 'ACTIVE' } } } }),
    ]);
    let created = 0;
    for (const tenant of tenants) for (const membership of tenant.memberships) for (const contract of contracts) {
      const subject = `Deadline: ${contract.title || contract.noticeId} · ${contract.responseDeadline.toISOString()}`;
      const exists = await this.prisma.notificationEvent.findFirst({ where: { tenantId: tenant.id, ownerId: membership.email, eventType: 'DEADLINE', subject } });
      if (!exists) created += (await this.emit({ tenantId: tenant.id, ownerId: membership.email, eventType: 'DEADLINE', subject, payload: { noticeId: contract.noticeId, deadline: contract.responseDeadline, message: `The response deadline is within ${days} days. Confirm the authoritative SAM.gov record before acting.` } })).length;
    }
    return created;
  }

  async deliver(event) {
    const subscription = event.subscriptionId
      ? await this.prisma.notificationSubscription.findUnique({ where: { id: event.subscriptionId } })
      : null;
    if (event.channel === 'IN_APP') return this.markDelivered(event.id);
    if (!subscription?.encryptedDestination) throw new Error('Notification destination is missing');
    const destination = decrypt(subscription.encryptedDestination, this.config);
    if (event.channel === 'EMAIL' || event.channel === 'CALENDAR') {
      if (!this.transport || !this.config.notificationFrom) throw new Error('SMTP_URL and NOTIFICATION_FROM are required');
      await this.transport.sendMail({
        from: this.config.notificationFrom,
        to: destination,
        subject: event.subject,
        text: String(event.payload?.message || event.subject),
        ...(event.channel === 'CALENDAR' ? { icalEvent: { method: 'PUBLISH', content: calendarText(event) } } : {}),
      });
    } else {
      const url = new URL(destination);
      if (url.protocol !== 'https:') throw new Error('Webhook destinations must use HTTPS');
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: event.subject, event: event.eventType, ...event.payload }) });
      if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    }
    return this.markDelivered(event.id);
  }

  markDelivered(id) {
    return this.prisma.notificationEvent.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: new Date(), error: null } });
  }

  async deliverPending(limit = 20) {
    const events = await this.prisma.notificationEvent.findMany({ where: { status: 'PENDING', scheduledAt: { lte: new Date() } }, orderBy: { scheduledAt: 'asc' }, take: limit });
    for (const event of events) {
      await runWithTenant(event.tenantId, async () => {
        try { await this.deliver(event); }
        catch (error) {
          await this.prisma.notificationEvent.update({ where: { id: event.id }, data: { attempts: { increment: 1 }, status: event.attempts >= 4 ? 'FAILED' : 'PENDING', error: error.message, scheduledAt: new Date(Date.now() + 60000 * (event.attempts + 1)) } });
        }
      });
    }
    return events.length;
  }
}

module.exports = { CHANNELS, EVENT_TYPES, NotificationService, decrypt, encrypt, opportunityMatches };
