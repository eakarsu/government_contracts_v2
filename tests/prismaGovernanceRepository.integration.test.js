const { PrismaClient } = require('@prisma/client');
const { ComplianceDecisionService } = require('../services/complianceDecisionService');
const PrismaGovernanceRepository = require('../services/prismaGovernanceRepository');

const run = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

run('Prisma governance persistence', () => {
  const prisma = new PrismaClient();
  const clock = () => new Date('2026-01-15T12:00:00.000Z');
  const service = new ComplianceDecisionService(new PrismaGovernanceRepository(prisma), { clock });
  const unique = `integration-${process.pid}-${Date.now()}`;

  afterAll(async () => prisma.$disconnect());

  test('persists, exports, and database-protects a released decision and its audit chain', async () => {
    const contract = await prisma.contract.create({
      data: { noticeId: unique, title: 'Integration contract' },
    });
    const policy = await service.createPolicy(
      {
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        jurisdiction: 'US-FEDERAL',
        policyKey: unique,
        rules: [{ id: 'RULE-1', description: 'Evidence is required.' }],
        title: 'Integration policy',
        version: 1,
      },
      { id: 'policy-admin' }
    );
    const { source } = await service.ingestSource(
      {
        authority: 'Acquisition.gov',
        content: `Authoritative source content ${unique}`,
        documentIdentifier: unique,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        evidenceUrl: 'https://www.acquisition.gov/far',
        jurisdiction: 'US-FEDERAL',
        retrievedAt: '2026-01-15T10:00:00.000Z',
        sourceKey: unique,
        title: 'Integration source',
      },
      { id: 'regulatory-ingestor' }
    );
    const evaluation = await service.createEvaluation(
      {
        citations: [{ id: 'citation-1', locator: 'FAR 1.102', sourceId: source.id }],
        contractId: contract.noticeId,
        deadlines: [],
        evidenceLinks: ['https://sam.gov/opp/integration'],
        jurisdiction: 'US-FEDERAL',
        obligations: [{ id: 'obligation-1', ownerId: 'owner', status: 'SATISFIED', text: 'Evidence checked.' }],
        ownerId: 'owner',
        policyId: policy.id,
        riskRating: 'LOW',
        riskRationale: 'The authoritative citation and supplied evidence were independently checked.',
        scenario: 'AWARD_ACCEPTANCE',
        sourceId: source.id,
      },
      { id: 'analyst' }
    );

    await service.submitEvaluation(evaluation.id, { id: 'analyst' });
    const approved = await service.decide(
      evaluation.id,
      { decision: 'APPROVED', rationale: 'Independent approval confirmed the evidence and every obligation.' },
      { id: 'approver' }
    );
    expect(approved.status).toBe('APPROVED');

    const auditExport = await service.exportDecision(evaluation.id, { id: 'auditor' });
    expect(auditExport.auditEvents).toHaveLength(3);
    expect(auditExport.manifestHash).toMatch(/^[a-f0-9]{64}$/);

    await expect(
      prisma.complianceEvaluation.update({ where: { id: evaluation.id }, data: { riskRating: 'CRITICAL' } })
    ).rejects.toThrow(/released compliance decisions are immutable/i);
    await expect(
      prisma.governanceAuditEvent.update({
        where: { id: auditExport.auditEvents[0].id },
        data: { action: 'TAMPERED' },
      })
    ).rejects.toThrow(/governance audit events are append-only/i);
  });
});
