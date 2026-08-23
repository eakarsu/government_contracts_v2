'use strict';

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const config = require('../config/env');
const { prisma } = require('../config/database');
const { requirePermission } = require('../middleware/auth');
const { PipelineReliabilityService } = require('../services/pipelineReliabilityService');

const router = express.Router();
const reliability = new PipelineReliabilityService(prisma);
const execute = promisify(execFile);

function databaseName(url) {
  try { return new URL(url).pathname.replace(/^\//, ''); } catch { return 'unparseable'; }
}

router.get('/readiness', requirePermission('operations:read'), async (_req, res) => {
  const checks = [];
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'database', status: 'pass' });
  } catch (error) {
    checks.push({ name: 'database', status: 'fail', message: error.message });
  }
  const queue = await reliability.status().catch(error => ({ error: error.message }));
  const expiredLeases = await prisma.durableTask.count({ where: { status: 'RUNNING', leaseExpiresAt: { lt: new Date() } } }).catch(() => -1);
  const activeWorkers = await prisma.workerHeartbeat.findMany({ where: { status: 'RUNNING', lastSeenAt: { gte: new Date(Date.now() - 90000) } }, select: { workerId: true, capabilities: true, lastSeenAt: true } }).catch(() => []);
  checks.push({ name: 'durable_workers', status: config.pipelineExecutionMode === 'durable' && expiredLeases === 0 && activeWorkers.length > 0 ? 'pass' : config.nodeEnv === 'production' ? 'fail' : 'warn', detail: { mode: config.pipelineExecutionMode, expiredLeases, activeWorkers } });
  try {
    await execute(config.malwareScannerCommand, ['--version'], { timeout: 5000 });
    checks.push({ name: 'malware_scanner', status: config.malwareScanMode === 'required' ? 'pass' : 'warn', detail: { mode: config.malwareScanMode, command: config.malwareScannerCommand } });
  } catch (error) {
    checks.push({ name: 'malware_scanner', status: config.malwareScanMode === 'required' ? 'fail' : 'warn', detail: { message: error.message } });
  }
  checks.push({ name: 'document_storage', status: config.storageProvider === 's3' ? 'pass' : config.nodeEnv === 'production' ? 'fail' : 'warn', detail: { provider: config.storageProvider, retentionDays: config.s3RetentionDays } });
  checks.push({
    name: 'identity_provider',
    status: config.nodeEnv !== 'production' || config.authMode === 'oidc' ? 'pass' : 'fail',
    detail: { mode: config.authMode },
  });
  checks.push({
    name: 'environment_isolation',
    status: config.nodeEnv === 'production' && /(?:test|dev|local)/i.test(databaseName(config.databaseUrl)) ? 'warn' : 'pass',
    detail: { environment: config.nodeEnv, database: databaseName(config.databaseUrl) },
  });
  const backupDirectory = process.env.BACKUP_DIRECTORY;
  let latestBackup = null;
  if (backupDirectory && await fs.pathExists(backupDirectory)) {
    const entries = await fs.readdir(backupDirectory);
    const candidates = await Promise.all(entries.filter(name => name.endsWith('.dump.enc')).map(async name => {
      const filePath = path.join(backupDirectory, name);
      return { name, modifiedAt: (await fs.stat(filePath)).mtime };
    }));
    latestBackup = candidates.sort((a, b) => b.modifiedAt - a.modifiedAt)[0] || null;
  }
  checks.push({
    name: 'backup_freshness',
    status: latestBackup && Date.now() - latestBackup.modifiedAt.getTime() < 25 * 60 * 60 * 1000 ? 'pass' : 'warn',
    detail: latestBackup ? { file: latestBackup.name, modifiedAt: latestBackup.modifiedAt } : { message: 'No recent backup was found' },
  });
  const overdueRotations = await prisma.secretRotationRecord.count({ where: { status: 'ACTIVE', expiresAt: { lt: new Date() } } }).catch(() => -1);
  checks.push({ name: 'secret_rotation', status: overdueRotations > 0 ? 'fail' : overdueRotations < 0 ? 'warn' : 'pass', detail: { overdue: overdueRotations } });
  const status = checks.some(check => check.status === 'fail') ? 'not_ready' : checks.some(check => check.status === 'warn') ? 'ready_with_warnings' : 'ready';
  return res.status(status === 'not_ready' ? 503 : 200).json({
    success: status !== 'not_ready', status, checkedAt: new Date().toISOString(), checks, queue,
    secrets: {
      samGovApiKeyConfigured: Boolean(config.samGovApiKey),
      openRouterApiKeyConfigured: Boolean(config.openRouterApiKey),
      valuesExposed: false,
    },
  });
});

router.get('/tasks', requirePermission('operations:read'), async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const tasks = await prisma.durableTask.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  const counts = await prisma.durableTask.groupBy({ by: ['status'], _count: { _all: true } });
  return res.json({ tasks, counts: Object.fromEntries(counts.map(row => [row.status, row._count._all])) });
});

router.post('/tasks/:id/retry', requirePermission('queue:admin'), async (req, res) => {
  const task = await prisma.durableTask.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!['FAILED', 'RETRY'].includes(task.status)) return res.status(409).json({ error: 'Only failed or retrying tasks can be reset' });
  const updated = await prisma.durableTask.update({ where: { id: task.id }, data: { status: 'RETRY', availableAt: new Date(), error: null, completedAt: null, leasedBy: null, leaseExpiresAt: null } });
  return res.json({ task: updated });
});

router.get('/document-security', requirePermission('operations:read'), async (_req, res) => {
  const [storage, malware] = await Promise.all([
    prisma.storedDocument.groupBy({ by: ['storageProvider', 'encryption'], _count: { _all: true }, _sum: { byteSize: true } }),
    prisma.storedDocument.groupBy({ by: ['malwareStatus'], _count: { _all: true } }),
  ]);
  return res.json({ storage, malware, policy: { provider: config.storageProvider, malwareScanMode: config.malwareScanMode, retentionDays: config.s3RetentionDays } });
});

module.exports = router;
