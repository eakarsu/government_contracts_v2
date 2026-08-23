'use strict';

const os = require('node:os');
const config = require('./config/env');
const { prisma, testConnection, disconnect } = require('./config/database');
const { DurableTaskQueue } = require('./services/durableTaskQueue');
const { runWithTenant } = require('./services/tenantContext');
const { NotificationService } = require('./services/notificationService');

const workerId = `${os.hostname()}:${process.pid}`;
const queue = new DurableTaskQueue(prisma);
const notifications = new NotificationService({ prisma });
let stopping = false;
let nextDeadlineSweepAt = 0;
let nextHeartbeatAt = 0;

async function documentExtractionTask(task) {
  const { processDocumentsInParallel } = require('./routes/documentProcessing');
  const ids = (task.payload.documentIds || []).map(Number).filter(Number.isInteger);
  const documents = await prisma.documentProcessingQueue.findMany({ where: { id: { in: ids } } });
  if (!documents.length) throw new Error('No queued documents remain for this task');
  await processDocumentsInParallel(documents, Number(task.payload.concurrency || 2), Number(task.payload.jobId));
  return { processedDocuments: documents.length, jobId: task.payload.jobId };
}

async function contractVectorIndexingTask(task) {
  const vectorService = require('./services/vectorServiceInstance');
  if (!vectorService.isConnected) await vectorService.initialize();
  const ids = (task.payload.contractIds || []).map(Number).filter(Number.isInteger);
  const contracts = await prisma.contract.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  let indexed = 0; let errors = 0;
  for (const contract of contracts) {
    try {
      if (!await vectorService.indexContract(contract)) throw new Error('Vector service did not index the contract');
      await prisma.contract.update({ where: { id: contract.id }, data: { indexedAt: new Date() } });
      indexed++;
    } catch (error) { errors++; console.error(`[worker] contract ${contract.noticeId}: ${error.message}`); }
  }
  if (task.payload.jobId) await prisma.indexingJob.update({ where: { id: Number(task.payload.jobId) }, data: { status: errors ? 'completed_with_errors' : 'completed', recordsProcessed: indexed, errorsCount: errors, completedAt: new Date() } });
  return { indexed, errors, jobId: task.payload.jobId };
}

const handlers = { DOCUMENT_EXTRACTION_INDEXING: documentExtractionTask, CONTRACT_VECTOR_INDEXING: contractVectorIndexingTask };

async function runTask(task) {
  const handler = handlers[task.taskType];
  if (!handler) throw new Error(`Unsupported durable task type: ${task.taskType}`);
  const heartbeat = setInterval(() => queue.heartbeat(task.id, workerId).catch(() => {}), Math.max(5000, Math.floor(config.workerLeaseMs / 3)));
  heartbeat.unref();
  try {
    const result = await runWithTenant(task.tenantId, () => handler(task));
    await queue.complete(task.id, workerId, result);
  } catch (error) {
    await queue.fail(task, workerId, error);
    if (String(task.createdBy).includes('@')) await notifications.emit({ tenantId: task.tenantId, ownerId: task.createdBy, eventType: 'FAILED_JOB', subject: `Pipeline task failed: ${task.taskType}`, payload: { taskId: task.id, attempts: task.attempts, message: error.message } }).catch(() => {});
    console.error(`[worker] ${task.id} failed: ${error.message}`);
  } finally {
    clearInterval(heartbeat);
  }
}

async function main() {
  config.validateForStartup(config);
  await testConnection();
  await queue.recoverExpired();
  console.log(`[worker] ${workerId} ready; concurrency=${config.workerConcurrency}`);
  const active = new Set();
  while (!stopping) {
    if (Date.now() >= nextHeartbeatAt) {
      await prisma.workerHeartbeat.upsert({ where: { workerId }, create: { workerId, hostname: os.hostname(), processId: process.pid, capabilities: Object.keys(handlers), version: require('./package.json').version }, update: { status: 'RUNNING', lastSeenAt: new Date(), capabilities: Object.keys(handlers), version: require('./package.json').version } });
      nextHeartbeatAt = Date.now() + 30000;
    }
    await notifications.deliverPending(20).catch(error => console.error(`[worker] notification delivery: ${error.message}`));
    if (Date.now() >= nextDeadlineSweepAt) {
      await notifications.scheduleDeadlineReminders(7).catch(error => console.error(`[worker] deadline reminders: ${error.message}`));
      nextDeadlineSweepAt = Date.now() + 15 * 60 * 1000;
    }
    while (active.size < config.workerConcurrency) {
      const task = await queue.lease(workerId, Object.keys(handlers));
      if (!task) break;
      const promise = runTask(task).finally(() => active.delete(promise));
      active.add(promise);
    }
    if (!active.size) await new Promise(resolve => setTimeout(resolve, config.workerPollMs));
    else await Promise.race([...active, new Promise(resolve => setTimeout(resolve, config.workerPollMs))]);
  }
  await Promise.allSettled([...active]);
  await prisma.workerHeartbeat.updateMany({ where: { workerId }, data: { status: 'STOPPED', lastSeenAt: new Date() } });
  await disconnect();
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; });
main().catch(error => { console.error(`[worker] fatal: ${error.stack || error.message}`); process.exitCode = 1; });
