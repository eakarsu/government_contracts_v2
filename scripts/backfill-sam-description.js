#!/usr/bin/env node
const config = require('../config/env');
const { prisma } = require('../config/database');
const { resolveSamNoticeDescription } = require('../services/samNoticeDescription');
const { RfpProductionService } = require('../services/rfpProductionService');
const { syncRfpRequirementsForNotice } = require('../services/samDescriptionBackfill');

function option(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find(value => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length).trim() : null;
}

async function main() {
  const noticeId = option('notice-id');
  const apply = process.argv.slice(2).includes('--apply');
  const syncRequirements = process.argv.slice(2).includes('--sync-requirements');
  if (!noticeId) throw new Error('Usage: node scripts/backfill-sam-description.js --notice-id=<exact SAM notice ID> [--apply] [--sync-requirements]');
  if (syncRequirements && !apply) throw new Error('--sync-requirements requires --apply');
  if (!config.samGovApiKey) throw new Error('SAM_GOV_API_KEY is required');

  const contract = await prisma.contract.findUnique({
    where: { noticeId },
    select: { description: true, noticeId: true, samData: true },
  });
  if (!contract) throw new Error(`Contract ${noticeId} was not found`);

  const rawSamDescription = contract.samData
    && typeof contract.samData === 'object'
    && !Array.isArray(contract.samData)
    && typeof contract.samData.description === 'string'
      ? contract.samData.description
      : contract.description;
  const resolved = await resolveSamNoticeDescription(rawSamDescription, {
    apiKey: config.samGovApiKey,
    fallbackDescription: contract.description,
  });
  if (resolved.status !== 'resolved') {
    throw new Error(`SAM description resolution did not succeed (${resolved.status}); no database change was made`);
  }

  if (apply) {
    await prisma.contract.update({
      where: { noticeId },
      data: { description: resolved.description, indexedAt: null },
    });
  }

  const requirementSync = syncRequirements
    ? await syncRfpRequirementsForNotice({
        noticeId,
        prisma,
        productionService: new RfpProductionService(prisma),
      })
    : { responseCount: 0, synchronizedResponses: [], totalRequirementCount: 0 };
  console.log(JSON.stringify({
    applied: apply,
    descriptionCharacters: resolved.description.length,
    event: 'sam_description_backfill',
    noticeId,
    requirementSync,
  }));
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
