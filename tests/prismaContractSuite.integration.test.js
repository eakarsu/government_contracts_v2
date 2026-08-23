'use strict';

const { PrismaClient } = require('@prisma/client');
const { assertIsolatedTestDatabase } = require('./testDatabaseGuard');
assertIsolatedTestDatabase();

const run = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

run('Prisma unified contract suite persistence', () => {
  const prisma = new PrismaClient();
  afterAll(async () => prisma.$disconnect());

  function matterData(suffix) {
    return {
      matterNumber: `integration-suite-${suffix}-${Date.now()}`, title: 'Contract suite integration matter', agency: 'GSA',
      contractType: 'Firm-Fixed-Price', jurisdiction: 'US-FEDERAL', ownerId: 'owner-integration', createdBy: 'creator-integration',
      retentionUntil: new Date('2033-01-01T00:00:00.000Z'),
    };
  }

  async function createWorkItem(transaction, suffix, overrides = {}) {
    const matter = await transaction.contractMatter.create({ data: matterData(suffix) });
    return transaction.contractCapabilityWorkItem.create({ data: {
      matterId: matter.id, domain: 'NEGOTIATION', capability: 'redline-review', sourceProject: 'integration-test',
      sourceRecordKey: `${suffix}-${Date.now()}`, title: 'Controlled redline review', summary: 'Validate the redline against approved fallback language.',
      status: 'OPEN', priority: 'HIGH', riskLevel: 'HIGH', ownerId: 'legal-integration', probability: 0.72,
      evidence: { documentDigest: 'a'.repeat(64) }, recommendation: 'Route material deviations to independent legal approval.', ...overrides,
    } });
  }

  test('database keeps capability AI evidence advisory and append-only', async () => {
    await expect(prisma.$transaction(async transaction => {
      const item = await createWorkItem(transaction, 'append-only');
      const analysis = await transaction.contractCapabilityAnalysis.create({ data: {
        workItemId: item.id, analysisType: 'NEGOTIATION_ADVISORY', inputDigest: 'b'.repeat(64),
        output: { summary: 'Advisory result', riskAssessment: [], evidenceGaps: [], recommendations: [], humanDecision: 'Legal review' },
        model: 'integration-model', advisoryOnly: true, status: 'PENDING_HUMAN_REVIEW', createdBy: 'analyst-integration',
      } });
      await transaction.contractCapabilityAnalysis.update({ where: { id: analysis.id }, data: { status: 'ACCEPTED' } });
    })).rejects.toThrow(/append-only/i);
  });

  test('database rejects invalid probabilities and approvals without human evidence', async () => {
    await expect(prisma.$transaction(transaction => createWorkItem(transaction, 'probability', { probability: 1.2 }))).rejects.toThrow();
    await expect(prisma.$transaction(transaction => createWorkItem(transaction, 'approval', { status: 'APPROVED' }))).rejects.toThrow();
  });
});
