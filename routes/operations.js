'use strict';

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/env');
const { prisma } = require('../config/database');
const { requirePermission } = require('../middleware/auth');
const { PipelineReliabilityService } = require('../services/pipelineReliabilityService');

const router = express.Router();
const reliability = new PipelineReliabilityService(prisma);

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
    const candidates = await Promise.all(entries.filter(name => name.endsWith('.dump')).map(async name => {
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

module.exports = router;
