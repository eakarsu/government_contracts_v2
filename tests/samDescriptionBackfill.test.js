const {
  SAM_DESCRIPTION_BACKFILL_ACTOR,
  syncRfpRequirementsForNotice,
} = require('../services/samDescriptionBackfill');

test('synchronizes linked proposal requirements within each response tenant without deleting records', async () => {
  const prisma = {
    rfpResponse: {
      findMany: jest.fn().mockResolvedValue([
        { id: 4, tenantId: 'tenant-a' },
        { id: 9, tenantId: 'tenant-b' },
      ]),
    },
  };
  const productionService = {
    syncRequirements: jest.fn()
      .mockResolvedValueOnce([{ id: 'req-1' }, { id: 'req-2' }])
      .mockResolvedValueOnce([{ id: 'req-3' }]),
  };
  const tenantCalls = [];
  const runInTenant = jest.fn(async (tenantId, callback) => {
    tenantCalls.push(tenantId);
    return callback();
  });

  const result = await syncRfpRequirementsForNotice({
    noticeId: 'axiom-notice',
    prisma,
    productionService,
    runInTenant,
  });

  expect(prisma.rfpResponse.findMany).toHaveBeenCalledWith({
    where: { contractId: 'axiom-notice' },
    select: { id: true, tenantId: true },
    orderBy: { id: 'asc' },
  });
  expect(tenantCalls).toEqual(['tenant-a', 'tenant-b']);
  expect(productionService.syncRequirements).toHaveBeenNthCalledWith(1, 4, SAM_DESCRIPTION_BACKFILL_ACTOR);
  expect(productionService.syncRequirements).toHaveBeenNthCalledWith(2, 9, SAM_DESCRIPTION_BACKFILL_ACTOR);
  expect(result).toEqual({
    responseCount: 2,
    synchronizedResponses: [
      { id: 4, requirementCount: 2, tenantId: 'tenant-a' },
      { id: 9, requirementCount: 1, tenantId: 'tenant-b' },
    ],
    totalRequirementCount: 3,
  });
  expect(prisma.rfpRequirement?.delete).toBeUndefined();
  expect(prisma.rfpRequirement?.deleteMany).toBeUndefined();
});
