'use strict';

const crypto = require('node:crypto');
const config = require('../config/env');
const { currentTenantId } = require('./tenantContext');

class DurableTaskQueue {
  constructor(prisma, options = {}) {
    this.prisma = prisma;
    this.leaseMs = options.leaseMs || config.workerLeaseMs;
  }

  async enqueue(taskType, payload, options = {}) {
    const tenantId = currentTenantId() || options.tenantId || config.defaultTenantId;
    const createdBy = String(options.createdBy || 'system');
    const idempotencyKey = options.idempotencyKey || null;
    if (idempotencyKey) {
      const existing = await this.prisma.durableTask.findFirst({ where: { tenantId, idempotencyKey } });
      if (existing) return existing;
    }
    return this.prisma.durableTask.create({
      data: {
        tenantId,
        taskType,
        payload,
        priority: Number(options.priority || 100),
        maxAttempts: Number(options.maxAttempts || 3),
        idempotencyKey,
        createdBy,
      },
    });
  }

  async lease(workerId, taskTypes = []) {
    const leaseExpiresAt = new Date(Date.now() + this.leaseMs);
    const typeFilter = taskTypes.length ? taskTypes : null;
    return this.prisma.$transaction(async tx => {
      const rows = typeFilter
        ? await tx.$queryRaw`
            SELECT id FROM durable_task
            WHERE status IN ('PENDING', 'RETRY') AND available_at <= NOW()
              AND task_type = ANY(${typeFilter}::text[])
            ORDER BY priority ASC, created_at ASC
            FOR UPDATE SKIP LOCKED LIMIT 1`
        : await tx.$queryRaw`
            SELECT id FROM durable_task
            WHERE status IN ('PENDING', 'RETRY') AND available_at <= NOW()
            ORDER BY priority ASC, created_at ASC
            FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows.length) return null;
      return tx.durableTask.update({
        where: { id: rows[0].id },
        data: {
          status: 'RUNNING', leasedBy: workerId, leaseExpiresAt, heartbeatAt: new Date(),
          startedAt: new Date(), attempts: { increment: 1 }, error: null,
        },
      });
    });
  }

  async heartbeat(taskId, workerId) {
    const updated = await this.prisma.durableTask.updateMany({
      where: { id: taskId, leasedBy: workerId, status: 'RUNNING' },
      data: { heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + this.leaseMs) },
    });
    return updated.count === 1;
  }

  async complete(taskId, workerId, result = {}) {
    return this.prisma.durableTask.updateMany({
      where: { id: taskId, leasedBy: workerId, status: 'RUNNING' },
      data: { status: 'COMPLETED', result, completedAt: new Date(), leasedBy: null, leaseExpiresAt: null },
    });
  }

  async fail(task, workerId, error) {
    const retry = task.attempts < task.maxAttempts;
    const delayMs = Math.min(30 * 60 * 1000, 5000 * (2 ** Math.max(0, task.attempts - 1)));
    return this.prisma.durableTask.updateMany({
      where: { id: task.id, leasedBy: workerId, status: 'RUNNING' },
      data: {
        status: retry ? 'RETRY' : 'FAILED',
        availableAt: retry ? new Date(Date.now() + delayMs) : task.availableAt,
        error: String(error?.stack || error?.message || error).slice(0, 16000),
        completedAt: retry ? null : new Date(),
        leasedBy: null,
        leaseExpiresAt: null,
      },
    });
  }

  async recoverExpired() {
    const expired = await this.prisma.durableTask.findMany({
      where: { status: 'RUNNING', leaseExpiresAt: { lt: new Date() } },
      select: { id: true, attempts: true, maxAttempts: true },
    });
    for (const task of expired) {
      await this.prisma.durableTask.update({
        where: { id: task.id },
        data: {
          status: task.attempts < task.maxAttempts ? 'RETRY' : 'FAILED',
          availableAt: new Date(), leasedBy: null, leaseExpiresAt: null,
          error: 'Worker lease expired; task recovered automatically',
          completedAt: task.attempts < task.maxAttempts ? null : new Date(),
        },
      });
    }
    return expired.length;
  }

  static idempotencyKey(prefix, payload) {
    return `${prefix}:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
  }
}

module.exports = { DurableTaskQueue };
