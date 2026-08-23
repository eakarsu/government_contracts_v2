const { PrismaClient } = require('@prisma/client');
const { assertIsolatedTestDatabase } = require('./testDatabaseGuard');
assertIsolatedTestDatabase();

const run = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

run('Prisma contract lifecycle persistence', () => {
  const prisma = new PrismaClient();
  afterAll(async () => prisma.$disconnect());

  function matterData(suffix) {
    return {
      matterNumber: `integration-lifecycle-${suffix}-${Date.now()}`,
      title: 'Integration lifecycle matter', agency: 'GSA', contractType: 'Firm-Fixed-Price',
      jurisdiction: 'US-FEDERAL', ownerId: 'owner-integration', createdBy: 'creator-integration',
      retentionUntil: new Date('2033-01-01T00:00:00.000Z'),
    };
  }

  test('database prevents mutation of immutable document evidence', async () => {
    await expect(prisma.$transaction(async transaction => {
      const matter = await transaction.contractMatter.create({ data: matterData('document') });
      const document = await transaction.contractDocumentVersion.create({ data: {
        matterId: matter.id, documentType: 'BASE_CONTRACT', title: 'Signed contract', version: 1,
        sourceUrl: 'https://sam.gov/integration', contentHash: 'a'.repeat(64), uploadedBy: 'operator-integration',
      } });
      await transaction.contractDocumentVersion.update({ where: { id: document.id }, data: { title: 'Tampered title' } });
    })).rejects.toThrow(/contract lifecycle evidence is append-only/i);
  });

  test('database rejects non-advisory AI records', async () => {
    await expect(prisma.$transaction(async transaction => {
      const matter = await transaction.contractMatter.create({ data: matterData('ai') });
      await transaction.contractAiReview.create({ data: {
        matterId: matter.id, reviewType: 'READINESS', promptDigest: 'b'.repeat(64), output: 'test', model: 'test-model',
        citations: [], advisoryOnly: false, status: 'PENDING_HUMAN_REVIEW', createdBy: 'analyst-integration',
      } });
    })).rejects.toThrow();
  });
});
