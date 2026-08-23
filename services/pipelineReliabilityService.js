'use strict';

class PipelineReliabilityService {
  constructor(prisma, { staleMinutes = 20 } = {}) {
    this.prisma = prisma;
    this.staleMinutes = staleMinutes;
  }

  async maintain(now = new Date()) {
    const staleBefore = new Date(now.getTime() - this.staleMinutes * 60 * 1000);
    return this.prisma.$transaction(async tx => {
      const stale = await tx.documentProcessingQueue.findMany({
        where: { status: 'processing', startedAt: { lt: staleBefore } },
        select: { id: true, retryCount: true, maxRetries: true },
      });
      let recovered = 0;
      let deadLettered = 0;
      for (const item of stale) {
        const retries = item.retryCount + 1;
        const exhausted = retries >= item.maxRetries;
        await tx.documentProcessingQueue.update({
          where: { id: item.id },
          data: exhausted
            ? { status: 'dead_letter', retryCount: retries, deadLetteredAt: now, errorMessage: 'Processing lease expired after maximum retries' }
            : { status: 'queued', retryCount: retries, startedAt: null, nextRetryAt: now, errorMessage: 'Recovered stale processing lease' },
        });
        exhausted ? deadLettered++ : recovered++;
      }

      const failed = await tx.documentProcessingQueue.findMany({
        where: {
          status: 'failed',
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        select: { id: true, retryCount: true, maxRetries: true },
      });
      let requeued = 0;
      for (const item of failed) {
        if (item.retryCount >= item.maxRetries) {
          await tx.documentProcessingQueue.update({
            where: { id: item.id },
            data: { status: 'dead_letter', deadLetteredAt: now },
          });
          deadLettered++;
          continue;
        }
        const retries = item.retryCount + 1;
        await tx.documentProcessingQueue.update({
          where: { id: item.id },
          data: { status: 'queued', retryCount: retries, startedAt: null, nextRetryAt: null, lastAttemptAt: now },
        });
        requeued++;
      }
      return { staleFound: stale.length, recovered, requeued, deadLettered };
    });
  }

  async status() {
    const [grouped, duplicateGroups] = await Promise.all([
      this.prisma.documentProcessingQueue.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.documentProcessingQueue.groupBy({
        by: ['sourceChecksum'],
        where: { sourceChecksum: { not: null } },
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } },
      }),
    ]);
    return {
      counts: Object.fromEntries(grouped.map(item => [item.status, item._count.id])),
      duplicateChecksumGroups: duplicateGroups.length,
      staleAfterMinutes: this.staleMinutes,
    };
  }

  async requeueDeadLetter(id) {
    const item = await this.prisma.documentProcessingQueue.findUnique({ where: { id } });
    if (!item) throw Object.assign(new Error('Queue item not found'), { statusCode: 404 });
    if (item.status !== 'dead_letter') throw Object.assign(new Error('Only dead-letter items can be requeued'), { statusCode: 409 });
    return this.prisma.documentProcessingQueue.update({
      where: { id },
      data: {
        status: 'queued', retryCount: 0, deadLetteredAt: null, nextRetryAt: null,
        startedAt: null, failedAt: null, errorMessage: null,
      },
    });
  }
}

module.exports = { PipelineReliabilityService };
