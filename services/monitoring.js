'use strict';

const crypto = require('node:crypto');
const client = require('prom-client');
const config = require('../config/env');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'govcontract_' });
const requests = new client.Counter({ name: 'govcontract_http_requests_total', help: 'HTTP requests', labelNames: ['method', 'route', 'status'], registers: [register] });
const duration = new client.Histogram({ name: 'govcontract_http_request_duration_seconds', help: 'HTTP request duration', labelNames: ['method', 'route', 'status'], buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 15, 60], registers: [register] });
const durableTasks = new client.Gauge({ name: 'govcontract_durable_tasks', help: 'Durable tasks by status', labelNames: ['status'], registers: [register] });
const documentQueue = new client.Gauge({ name: 'govcontract_document_queue', help: 'Documents by status', labelNames: ['status'], registers: [register] });

let sentry = null;
if (config.sentryDsn) {
  sentry = require('@sentry/node');
  sentry.init({ dsn: config.sentryDsn, environment: config.nodeEnv, sendDefaultPii: false, tracesSampleRate: config.sentryTracesSampleRate });
}

function routeLabel(req) { return req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : (req.baseUrl || 'unmatched'); }
function metricsMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const labels = { method: req.method, route: routeLabel(req), status: String(res.statusCode) };
    requests.inc(labels);
    duration.observe(labels, Number(process.hrtime.bigint() - started) / 1e9);
  });
  next();
}

function monitoringAuthorized(req) {
  const expected = String(config.monitoringToken || '');
  const actual = String(req.get('x-monitoring-token') || '').trim();
  if (!expected || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

async function refreshDatabaseMetrics(prisma) {
  const [tasks, docs] = await Promise.all([
    prisma.durableTask.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.documentProcessingQueue.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  durableTasks.reset(); documentQueue.reset();
  tasks.forEach(row => durableTasks.set({ status: row.status }, row._count._all));
  docs.forEach(row => documentQueue.set({ status: row.status }, row._count._all));
}

function captureException(error, context = {}) {
  if (sentry) sentry.captureException(error, { extra: context });
}

module.exports = { captureException, metricsMiddleware, monitoringAuthorized, refreshDatabaseMetrics, register };
