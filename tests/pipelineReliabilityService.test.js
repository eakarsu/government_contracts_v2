const { PipelineReliabilityService } = require('../services/pipelineReliabilityService');

test('recovers stale leases and dead-letters exhausted items', async () => {
  const updates = [];
  const tx = {
    documentProcessingQueue: {
      findMany: jest.fn()
        .mockResolvedValueOnce([
          { id: 1, retryCount: 0, maxRetries: 3 },
          { id: 2, retryCount: 2, maxRetries: 3 },
        ])
        .mockResolvedValueOnce([
          { id: 3, retryCount: 0, maxRetries: 3 },
          { id: 4, retryCount: 3, maxRetries: 3 },
        ]),
      update: jest.fn(input => { updates.push(input); return input; }),
    },
  };
  const prisma = { $transaction: callback => callback(tx) };
  const result = await new PipelineReliabilityService(prisma).maintain(new Date('2026-08-23T12:00:00Z'));
  expect(result).toEqual({ staleFound: 2, recovered: 1, requeued: 1, deadLettered: 2 });
  expect(updates.find(item => item.where.id === 1).data.status).toBe('queued');
  expect(updates.find(item => item.where.id === 2).data.status).toBe('dead_letter');
  expect(updates.find(item => item.where.id === 4).data.status).toBe('dead_letter');
});
