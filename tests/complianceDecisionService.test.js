const {
  ComplianceDecisionService,
  InMemoryGovernanceRepository,
} = require('../services/complianceDecisionService');

const fixedNow = new Date('2026-01-15T12:00:00.000Z');
const analyst = { id: 'analyst-1' };
const approver = { id: 'approver-1' };
const recordsOfficer = { id: 'records-1' };

function setup() {
  const repository = new InMemoryGovernanceRepository();
  const service = new ComplianceDecisionService(repository, { clock: () => fixedNow });
  return { repository, service };
}

async function fixtures(service, overrides = {}) {
  const policy = await service.createPolicy(
    {
      effectiveFrom: '2025-01-01T00:00:00.000Z',
      jurisdiction: 'US-FEDERAL',
      policyKey: 'FAR-RELEASE',
      rules: [{ id: 'FAR-1', description: 'Evidence must support every obligation' }],
      title: 'Federal acquisition release policy',
      version: 1,
      ...overrides.policy,
    },
    { id: 'policy-admin-1' }
  );
  const { source } = await service.ingestSource(
    {
      authority: 'Acquisition.gov',
      content: 'Authoritative regulation text, revision one.',
      documentIdentifier: 'FAR-2025-01',
      effectiveFrom: '2025-01-01T00:00:00.000Z',
      evidenceUrl: 'https://www.acquisition.gov/far',
      jurisdiction: 'US-FEDERAL',
      retrievedAt: '2026-01-15T10:00:00.000Z',
      sourceKey: 'FAR',
      title: 'Federal Acquisition Regulation',
      ...overrides.source,
    },
    { id: 'ingestor-1' }
  );
  return { policy, source };
}

function evaluationInput(policy, source, overrides = {}) {
  return {
    advisoryOutput: { model: 'advisory-only', text: 'Possible issue; human review required.' },
    citations: [{ id: 'citation-1', locator: 'FAR 1.102', sourceId: source.id }],
    contractId: 'notice-1',
    deadlines: [{ citationId: 'citation-1', date: '2026-02-15T17:00:00.000Z', id: 'deadline-1' }],
    evaluatedAt: fixedNow.toISOString(),
    evidenceLinks: ['https://sam.gov/opp/notice-1'],
    jurisdiction: 'US-FEDERAL',
    obligations: [
      { id: 'obligation-1', ownerId: 'owner-1', status: 'SATISFIED', text: 'Confirm response deadline.' },
    ],
    ownerId: 'owner-1',
    policyId: policy.id,
    riskRating: 'MEDIUM',
    riskRationale: 'Deadline and evidence were independently checked against the cited source.',
    scenario: 'BID_SUBMISSION',
    sourceId: source.id,
    ...overrides,
  };
}

test('versions policies and detects authoritative source changes idempotently', async () => {
  const { repository, service } = setup();
  const { policy, source } = await fixtures(service);
  expect(policy.version).toBe(1);
  expect(source.version).toBe(1);

  const duplicate = await service.ingestSource(
    {
      authority: 'Acquisition.gov',
      content: 'Authoritative regulation text, revision one.',
      documentIdentifier: 'FAR-2025-01',
      effectiveFrom: '2025-01-01T00:00:00.000Z',
      evidenceUrl: 'https://www.acquisition.gov/far',
      jurisdiction: 'US-FEDERAL',
      retrievedAt: '2026-01-15T11:00:00.000Z',
      sourceKey: 'FAR',
      title: 'Federal Acquisition Regulation',
    },
    { id: 'ingestor-1' }
  );
  expect(duplicate.changed).toBe(false);
  expect(duplicate.source.id).toBe(source.id);

  const changed = await service.ingestSource(
    {
      authority: 'Acquisition.gov',
      content: 'Authoritative regulation text, revision two.',
      documentIdentifier: 'FAR-2026-01',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      evidenceUrl: 'https://www.acquisition.gov/far',
      jurisdiction: 'US-FEDERAL',
      retrievedAt: '2026-01-15T11:30:00.000Z',
      sourceKey: 'FAR',
      title: 'Federal Acquisition Regulation',
    },
    { id: 'ingestor-1' }
  );
  expect(changed.changed).toBe(true);
  expect(changed.source.version).toBe(2);
  expect(changed.source.supersedesId).toBe(source.id);
  expect(repository.auditEvents.some(event => event.action === 'SOURCE_CHANGE_DETECTED')).toBe(true);
});

test('rejects duplicate policy versions and non-HTTPS evidence', async () => {
  const { service } = setup();
  await fixtures(service);
  await expect(
    service.createPolicy(
      {
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        jurisdiction: 'US-FEDERAL',
        policyKey: 'FAR-RELEASE',
        rules: [{ id: 'x' }],
        title: 'duplicate',
        version: 1,
      },
      { id: 'policy-admin-2' }
    )
  ).rejects.toMatchObject({ code: 'POLICY_VERSION_EXISTS' });
  await expect(
    service.ingestSource(
      {
        authority: 'Unknown',
        content: 'content',
        documentIdentifier: 'bad',
        effectiveFrom: '2025-01-01',
        evidenceUrl: 'http://example.com/rule',
        jurisdiction: 'US-FEDERAL',
        retrievedAt: fixedNow.toISOString(),
        sourceKey: 'BAD',
        title: 'Bad source',
      },
      { id: 'ingestor-1' }
    )
  ).rejects.toMatchObject({ code: 'INVALID_EVIDENCE_URL' });
});

test.each([
  ['CITATIONS_REQUIRED', { citations: [] }],
  ['EVIDENCE_REQUIRED', { evidenceLinks: [] }],
  ['OBLIGATIONS_REQUIRED', { obligations: [] }],
  ['DEADLINES_REQUIRED', { deadlines: [] }],
  ['INVALID_RISK', { riskRating: 'UNKNOWN' }],
  ['JURISDICTION_MISMATCH', { jurisdiction: 'US-STATE-NY' }],
])('blocks incomplete release evaluation: %s', async (code, overrides) => {
  const { service } = setup();
  const { policy, source } = await fixtures(service);
  await expect(service.createEvaluation(evaluationInput(policy, source, overrides), analyst)).rejects.toMatchObject({ code });
});

test('keeps AI output advisory and enforces submitter ownership', async () => {
  const { service } = setup();
  const { policy, source } = await fixtures(service);
  const evaluation = await service.createEvaluation(evaluationInput(policy, source), analyst);
  expect(evaluation.status).toBe('DRAFT');
  expect(evaluation.approvedBy).toBeNull();
  expect(evaluation.advisoryOutput.model).toBe('advisory-only');
  await expect(service.submitEvaluation(evaluation.id, { id: 'unrelated-analyst' })).rejects.toMatchObject({
    code: 'NOT_EVALUATION_OWNER',
  });
  const submitted = await service.submitEvaluation(evaluation.id, analyst);
  expect(submitted.status).toBe('PENDING_APPROVAL');
  expect(submitted.submittedBy).toBe(analyst.id);
});

test('enforces segregation of duties and blocks approval with unsatisfied obligations', async () => {
  const { service } = setup();
  const { policy, source } = await fixtures(service);
  const evaluation = await service.createEvaluation(
    evaluationInput(policy, source, {
      obligations: [
        { id: 'obligation-1', ownerId: 'owner-1', status: 'UNSATISFIED', text: 'Missing representation.' },
      ],
    }),
    analyst
  );
  await service.submitEvaluation(evaluation.id, analyst);
  await expect(
    service.decide(evaluation.id, { decision: 'APPROVED', rationale: 'Analyst cannot approve this decision.' }, analyst)
  ).rejects.toMatchObject({ code: 'SEGREGATION_OF_DUTIES' });
  await expect(
    service.decide(
      evaluation.id,
      { decision: 'APPROVED', rationale: 'Independent review found the package acceptable.' },
      approver
    )
  ).rejects.toMatchObject({ code: 'UNSATISFIED_OBLIGATION' });
});

test('releases an immutable accountable decision with retention, legal hold, and verifiable export', async () => {
  const { service } = setup();
  const { policy, source } = await fixtures(service);
  const draft = await service.createEvaluation(evaluationInput(policy, source), analyst);
  await service.submitEvaluation(draft.id, analyst);
  const approved = await service.decide(
    draft.id,
    { decision: 'APPROVED', rationale: 'Independent evidence review confirms every release check.' },
    approver
  );
  expect(approved.status).toBe('APPROVED');
  expect(approved.approvedBy).toBe(approver.id);
  expect(approved.immutableHash).toMatch(/^[a-f0-9]{64}$/);
  expect(new Date(approved.retentionUntil).getUTCFullYear()).toBe(2033);
  await expect(
    service.decide(draft.id, { decision: 'REJECTED', rationale: 'A second decision is forbidden after release.' }, approver)
  ).rejects.toMatchObject({ code: 'IMMUTABLE_DECISION' });

  const held = await service.setLegalHold(draft.id, true, 'Preserve for active bid protest matter.', recordsOfficer);
  expect(held.legalHold).toBe(true);
  const exported = await service.exportDecision(draft.id, recordsOfficer);
  expect(exported.evaluation.immutableHash).toBe(approved.immutableHash);
  expect(exported.auditEvents.map(event => event.sequence)).toEqual([1, 2, 3, 4]);
  expect(exported.manifestHash).toMatch(/^[a-f0-9]{64}$/);
});

test('detects audit-chain tampering before export', async () => {
  const { repository, service } = setup();
  const { policy, source } = await fixtures(service);
  const draft = await service.createEvaluation(evaluationInput(policy, source), analyst);
  await service.submitEvaluation(draft.id, analyst);
  const event = repository.auditEvents.find(item => item.aggregateId === draft.id);
  event.payload.contractId = 'tampered';
  await expect(service.exportDecision(draft.id, recordsOfficer)).rejects.toMatchObject({ code: 'AUDIT_CHAIN_INVALID' });
});

test('verifies audit records after persistence adds tenant metadata and restores Date values', async () => {
  const { repository, service } = setup();
  const { policy, source } = await fixtures(service);
  const draft = await service.createEvaluation(evaluationInput(policy, source), analyst);
  await service.submitEvaluation(draft.id, analyst);

  const listAudit = repository.listAudit.bind(repository);
  repository.listAudit = async aggregateId => (await listAudit(aggregateId)).map(event => ({
    ...event,
    occurredAt: new Date(event.occurredAt),
    tenantId: 'default',
  }));

  const exported = await service.exportDecision(draft.id, recordsOfficer);
  expect(exported.auditEvents).toHaveLength(2);
  expect(exported.auditEvents.every(event => event.tenantId === 'default')).toBe(true);
  expect(exported.manifestHash).toMatch(/^[a-f0-9]{64}$/);
});
