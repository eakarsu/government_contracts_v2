const { runWithTenant } = require('./tenantContext');

const SAM_DESCRIPTION_BACKFILL_ACTOR = Object.freeze({ id: 'system:sam-description-backfill' });

async function syncRfpRequirementsForNotice({
  noticeId,
  prisma,
  productionService,
  runInTenant = runWithTenant,
}) {
  const responses = await prisma.rfpResponse.findMany({
    where: { contractId: noticeId },
    select: { id: true, tenantId: true },
    orderBy: { id: 'asc' },
  });
  const synchronizedResponses = [];
  for (const response of responses) {
    const requirements = await runInTenant(response.tenantId, () => (
      productionService.syncRequirements(response.id, SAM_DESCRIPTION_BACKFILL_ACTOR)
    ));
    synchronizedResponses.push({
      id: response.id,
      requirementCount: requirements.length,
      tenantId: response.tenantId,
    });
  }
  return {
    responseCount: synchronizedResponses.length,
    synchronizedResponses,
    totalRequirementCount: synchronizedResponses.reduce((sum, response) => sum + response.requirementCount, 0),
  };
}

module.exports = {
  SAM_DESCRIPTION_BACKFILL_ACTOR,
  syncRfpRequirementsForNotice,
};
