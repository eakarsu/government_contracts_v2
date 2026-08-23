const crypto = require('crypto');

const SCENARIOS = new Set(['AWARD_ACCEPTANCE', 'BID_SUBMISSION', 'SOLICITATION_RELEASE']);
const RISK_RATINGS = new Set(['CRITICAL', 'HIGH', 'LOW', 'MEDIUM']);

class GovernanceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stable(value[key]);
        return result;
      }, {});
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function governanceAuditRecord(value) {
  return {
    action: value.action,
    actorId: value.actorId,
    aggregateId: value.aggregateId,
    aggregateType: value.aggregateType,
    occurredAt: value.occurredAt,
    payload: value.payload,
  };
}

function isoDate(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new GovernanceError('INVALID_DATE', `${field} must be an ISO date`);
  return date.toISOString();
}

function nonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new GovernanceError('REQUIRED_FIELD', `${field} is required`);
  return value.trim();
}

function httpsUrl(value, field) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('not https');
    return url.toString();
  } catch (error) {
    throw new GovernanceError('INVALID_EVIDENCE_URL', `${field} must be an HTTPS URL`);
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

class InMemoryGovernanceRepository {
  constructor() {
    this.policies = new Map();
    this.sources = new Map();
    this.evaluations = new Map();
    this.auditEvents = [];
    this.counters = { audit: 0, evaluation: 0, policy: 0, source: 0 };
  }

  async createPolicy(record) {
    if ([...this.policies.values()].some(policy => policy.policyKey === record.policyKey && policy.version === record.version)) {
      throw new GovernanceError('POLICY_VERSION_EXISTS', 'Policy key/version already exists', 409);
    }
    const stored = { ...clone(record), id: `policy-${++this.counters.policy}` };
    this.policies.set(stored.id, stored);
    return clone(stored);
  }

  async getPolicy(id) {
    return clone(this.policies.get(id));
  }

  async findLatestSource(sourceKey) {
    return clone(
      [...this.sources.values()]
        .filter(source => source.sourceKey === sourceKey)
        .sort((left, right) => right.version - left.version)[0]
    );
  }

  async createSource(record) {
    const stored = { ...clone(record), id: `source-${++this.counters.source}` };
    this.sources.set(stored.id, stored);
    return clone(stored);
  }

  async getSource(id) {
    return clone(this.sources.get(id));
  }

  async createEvaluation(record) {
    const stored = { ...clone(record), id: `evaluation-${++this.counters.evaluation}` };
    this.evaluations.set(stored.id, stored);
    return clone(stored);
  }

  async getEvaluation(id) {
    return clone(this.evaluations.get(id));
  }

  async updateEvaluation(id, changes) {
    const current = this.evaluations.get(id);
    if (!current) return undefined;
    const stored = { ...current, ...clone(changes) };
    this.evaluations.set(id, stored);
    return clone(stored);
  }

  async appendAudit(record) {
    const aggregateEvents = this.auditEvents.filter(event => event.aggregateId === record.aggregateId);
    const previousHash = aggregateEvents.length ? aggregateEvents[aggregateEvents.length - 1].hash : 'GENESIS';
    const stored = {
      ...clone(record),
      hash: digest({ previousHash, record: governanceAuditRecord(record) }),
      id: `audit-${++this.counters.audit}`,
      previousHash,
      sequence: aggregateEvents.length + 1,
    };
    this.auditEvents.push(stored);
    return clone(stored);
  }

  async listAudit(aggregateId) {
    return clone(this.auditEvents.filter(event => event.aggregateId === aggregateId));
  }

  async listPolicies() {
    return clone([...this.policies.values()].sort((left, right) => right.version - left.version));
  }

  async listSources() {
    return clone([...this.sources.values()].sort((left, right) => right.version - left.version));
  }

  async listEvaluations() {
    return clone([...this.evaluations.values()].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))));
  }
}

class ComplianceDecisionService {
  constructor(repository, { clock = () => new Date() } = {}) {
    this.repository = repository;
    this.clock = clock;
  }

  now() {
    return this.clock().toISOString();
  }

  async overview() {
    const [policies, sources, evaluations] = await Promise.all([
      this.repository.listPolicies(), this.repository.listSources(), this.repository.listEvaluations(),
    ]);
    const statuses = evaluations.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {});
    return { policies: policies.length, sources: sources.length, evaluations: evaluations.length, statuses };
  }

  listPolicies() { return this.repository.listPolicies(); }
  listSources() { return this.repository.listSources(); }
  listEvaluations() { return this.repository.listEvaluations(); }

  async audit(aggregateType, aggregateId, action, actor, payload = {}) {
    return this.repository.appendAudit({
      action,
      actorId: nonEmpty(actor.id, 'actor.id'),
      aggregateId,
      aggregateType,
      occurredAt: this.now(),
      payload: clone(payload),
    });
  }

  async createPolicy(input, actor) {
    const effectiveFrom = isoDate(input.effectiveFrom, 'effectiveFrom');
    const effectiveTo = input.effectiveTo ? isoDate(input.effectiveTo, 'effectiveTo') : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new GovernanceError('INVALID_POLICY_WINDOW', 'effectiveTo must be after effectiveFrom');
    }
    if (!Number.isSafeInteger(input.version) || input.version < 1) {
      throw new GovernanceError('INVALID_POLICY_VERSION', 'Policy version must be a positive integer');
    }
    if (!Array.isArray(input.rules) || input.rules.length === 0) {
      throw new GovernanceError('POLICY_RULES_REQUIRED', 'At least one versioned policy rule is required');
    }

    const policy = await this.repository.createPolicy({
      createdAt: this.now(),
      createdBy: nonEmpty(actor.id, 'actor.id'),
      effectiveFrom,
      effectiveTo,
      jurisdiction: nonEmpty(input.jurisdiction, 'jurisdiction'),
      policyKey: nonEmpty(input.policyKey, 'policyKey'),
      rules: clone(input.rules),
      title: nonEmpty(input.title, 'title'),
      version: input.version,
    });
    await this.audit('POLICY', policy.id, 'POLICY_VERSION_CREATED', actor, { policyKey: policy.policyKey, version: policy.version });
    return policy;
  }

  async ingestSource(input, actor) {
    const sourceKey = nonEmpty(input.sourceKey, 'sourceKey');
    const content = nonEmpty(input.content, 'content');
    const contentHash = digest(content.replace(/\r\n/g, '\n'));
    const latest = await this.repository.findLatestSource(sourceKey);
    if (latest && latest.contentHash === contentHash) {
      await this.audit('SOURCE', latest.id, 'SOURCE_DUPLICATE_OBSERVED', actor, { retrievedAt: isoDate(input.retrievedAt, 'retrievedAt') });
      return { changed: false, source: latest };
    }

    const effectiveFrom = isoDate(input.effectiveFrom, 'effectiveFrom');
    const effectiveTo = input.effectiveTo ? isoDate(input.effectiveTo, 'effectiveTo') : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new GovernanceError('INVALID_SOURCE_WINDOW', 'effectiveTo must be after effectiveFrom');
    }

    const source = await this.repository.createSource({
      authority: nonEmpty(input.authority, 'authority'),
      contentHash,
      documentIdentifier: nonEmpty(input.documentIdentifier, 'documentIdentifier'),
      effectiveFrom,
      effectiveTo,
      evidenceUrl: httpsUrl(input.evidenceUrl, 'evidenceUrl'),
      ingestedBy: nonEmpty(actor.id, 'actor.id'),
      jurisdiction: nonEmpty(input.jurisdiction, 'jurisdiction'),
      retrievedAt: isoDate(input.retrievedAt, 'retrievedAt'),
      sourceKey,
      supersedesId: latest ? latest.id : null,
      title: nonEmpty(input.title, 'title'),
      version: latest ? latest.version + 1 : 1,
    });
    await this.audit('SOURCE', source.id, latest ? 'SOURCE_CHANGE_DETECTED' : 'SOURCE_INGESTED', actor, {
      contentHash,
      supersedesId: source.supersedesId,
      version: source.version,
    });
    return { changed: true, source };
  }

  validateEvaluation(input, policy, source) {
    if (!SCENARIOS.has(input.scenario)) throw new GovernanceError('INVALID_SCENARIO', 'Unsupported compliance scenario');
    if (!RISK_RATINGS.has(input.riskRating)) throw new GovernanceError('INVALID_RISK', 'Risk rating is required');
    if (policy.jurisdiction !== input.jurisdiction || source.jurisdiction !== input.jurisdiction) {
      throw new GovernanceError('JURISDICTION_MISMATCH', 'Policy, source, and evaluation jurisdictions must match');
    }
    const evaluatedAt = isoDate(input.evaluatedAt || this.now(), 'evaluatedAt');
    const policyEffectiveFrom = isoDate(policy.effectiveFrom, 'policy.effectiveFrom');
    const policyEffectiveTo = policy.effectiveTo ? isoDate(policy.effectiveTo, 'policy.effectiveTo') : null;
    const sourceEffectiveFrom = isoDate(source.effectiveFrom, 'source.effectiveFrom');
    const sourceEffectiveTo = source.effectiveTo ? isoDate(source.effectiveTo, 'source.effectiveTo') : null;
    if (evaluatedAt < policyEffectiveFrom || (policyEffectiveTo && evaluatedAt > policyEffectiveTo)) {
      throw new GovernanceError('POLICY_NOT_EFFECTIVE', 'Policy version is not effective for this evaluation');
    }
    if (evaluatedAt < sourceEffectiveFrom || (sourceEffectiveTo && evaluatedAt > sourceEffectiveTo)) {
      throw new GovernanceError('SOURCE_NOT_EFFECTIVE', 'Regulatory source is not effective for this evaluation');
    }
    if (!Array.isArray(input.citations) || input.citations.length === 0) {
      throw new GovernanceError('CITATIONS_REQUIRED', 'At least one source citation is required');
    }
    for (const citation of input.citations) {
      if (citation.sourceId !== source.id) throw new GovernanceError('INVALID_CITATION', 'Citation must reference the selected source');
      nonEmpty(citation.id, 'citation.id');
      nonEmpty(citation.locator, 'citation.locator');
    }
    if (!Array.isArray(input.evidenceLinks) || input.evidenceLinks.length === 0) {
      throw new GovernanceError('EVIDENCE_REQUIRED', 'At least one evidence link is required');
    }
    input.evidenceLinks.forEach((link, index) => httpsUrl(link, `evidenceLinks[${index}]`));
    if (!Array.isArray(input.obligations) || input.obligations.length === 0) {
      throw new GovernanceError('OBLIGATIONS_REQUIRED', 'At least one evaluated obligation is required');
    }
    for (const obligation of input.obligations) {
      nonEmpty(obligation.id, 'obligation.id');
      nonEmpty(obligation.ownerId, 'obligation.ownerId');
      nonEmpty(obligation.text, 'obligation.text');
      if (!['NOT_APPLICABLE', 'SATISFIED', 'UNSATISFIED'].includes(obligation.status)) {
        throw new GovernanceError('INVALID_OBLIGATION_STATUS', 'Obligation status is invalid');
      }
    }
    if (input.scenario === 'BID_SUBMISSION' && (!Array.isArray(input.deadlines) || input.deadlines.length === 0)) {
      throw new GovernanceError('DEADLINES_REQUIRED', 'Bid submissions require at least one checked deadline');
    }
    for (const deadline of input.deadlines || []) {
      isoDate(deadline.date, 'deadline.date');
      if (!input.citations.some(citation => citation.id === deadline.citationId)) {
        throw new GovernanceError('DEADLINE_CITATION_REQUIRED', 'Every deadline must reference a citation');
      }
    }
    return evaluatedAt;
  }

  async createEvaluation(input, actor) {
    const policy = await this.repository.getPolicy(input.policyId);
    const source = await this.repository.getSource(input.sourceId);
    if (!policy) throw new GovernanceError('POLICY_NOT_FOUND', 'Policy version not found', 404);
    if (!source) throw new GovernanceError('SOURCE_NOT_FOUND', 'Regulatory source not found', 404);
    const evaluatedAt = this.validateEvaluation(input, policy, source);
    const retentionUntil = input.retentionUntil
      ? isoDate(input.retentionUntil, 'retentionUntil')
      : new Date(new Date(this.now()).setUTCFullYear(new Date(this.now()).getUTCFullYear() + 7)).toISOString();

    const evaluation = await this.repository.createEvaluation({
      advisoryOutput: input.advisoryOutput || null,
      approvedAt: null,
      approvedBy: null,
      citations: clone(input.citations),
      contractId: nonEmpty(input.contractId, 'contractId'),
      createdAt: this.now(),
      createdBy: nonEmpty(actor.id, 'actor.id'),
      deadlines: clone(input.deadlines || []),
      decisionRationale: null,
      evaluatedAt,
      evidenceLinks: clone(input.evidenceLinks),
      immutableHash: null,
      jurisdiction: input.jurisdiction,
      legalHold: false,
      obligations: clone(input.obligations),
      ownerId: nonEmpty(input.ownerId, 'ownerId'),
      policyId: policy.id,
      policyKey: policy.policyKey,
      policyVersion: policy.version,
      retentionUntil,
      riskRationale: nonEmpty(input.riskRationale, 'riskRationale'),
      riskRating: input.riskRating,
      scenario: input.scenario,
      sourceContentHash: source.contentHash,
      sourceId: source.id,
      status: 'DRAFT',
      submittedAt: null,
      submittedBy: null,
      updatedAt: this.now(),
    });
    await this.audit('EVALUATION', evaluation.id, 'EVALUATION_DRAFT_CREATED', actor, {
      contractId: evaluation.contractId,
      policyVersion: evaluation.policyVersion,
      sourceContentHash: evaluation.sourceContentHash,
    });
    return evaluation;
  }

  async requireMutableEvaluation(id) {
    const evaluation = await this.repository.getEvaluation(id);
    if (!evaluation) throw new GovernanceError('EVALUATION_NOT_FOUND', 'Evaluation not found', 404);
    if (['APPROVED', 'REJECTED'].includes(evaluation.status)) {
      throw new GovernanceError('IMMUTABLE_DECISION', 'Released decisions are immutable', 409);
    }
    return evaluation;
  }

  async submitEvaluation(id, actor) {
    const evaluation = await this.requireMutableEvaluation(id);
    if (evaluation.status !== 'DRAFT') throw new GovernanceError('INVALID_STATE', 'Only draft evaluations can be submitted', 409);
    if (actor.id !== evaluation.createdBy && actor.id !== evaluation.ownerId) {
      throw new GovernanceError('NOT_EVALUATION_OWNER', 'Only the creator or accountable owner can submit', 403);
    }
    const updated = await this.repository.updateEvaluation(id, {
      status: 'PENDING_APPROVAL',
      submittedAt: this.now(),
      submittedBy: actor.id,
      updatedAt: this.now(),
    });
    await this.audit('EVALUATION', id, 'EVALUATION_SUBMITTED', actor, { status: updated.status });
    return updated;
  }

  async decide(id, input, actor) {
    const evaluation = await this.requireMutableEvaluation(id);
    if (evaluation.status !== 'PENDING_APPROVAL') {
      throw new GovernanceError('INVALID_STATE', 'Only submitted evaluations can be decided', 409);
    }
    if ([evaluation.createdBy, evaluation.ownerId, evaluation.submittedBy].includes(actor.id)) {
      throw new GovernanceError('SEGREGATION_OF_DUTIES', 'Creator, owner, and submitter cannot approve their own evaluation', 403);
    }
    if (!['APPROVED', 'REJECTED'].includes(input.decision)) {
      throw new GovernanceError('INVALID_DECISION', 'Decision must be APPROVED or REJECTED');
    }
    const rationale = nonEmpty(input.rationale, 'rationale');
    if (rationale.length < 20) throw new GovernanceError('RATIONALE_TOO_SHORT', 'Decision rationale must contain at least 20 characters');
    if (
      input.decision === 'APPROVED' &&
      evaluation.obligations.some(obligation => obligation.status === 'UNSATISFIED')
    ) {
      throw new GovernanceError('UNSATISFIED_OBLIGATION', 'An evaluation with unsatisfied obligations cannot be approved', 409);
    }

    const decidedAt = this.now();
    const immutableHash = digest({
      ...evaluation,
      approvedAt: decidedAt,
      approvedBy: actor.id,
      decisionRationale: rationale,
      status: input.decision,
    });
    const updated = await this.repository.updateEvaluation(id, {
      approvedAt: decidedAt,
      approvedBy: actor.id,
      decisionRationale: rationale,
      immutableHash,
      status: input.decision,
      updatedAt: decidedAt,
    });
    await this.audit('EVALUATION', id, `EVALUATION_${input.decision}`, actor, { immutableHash, rationale });
    return updated;
  }

  async setLegalHold(id, enabled, reason, actor) {
    const evaluation = await this.repository.getEvaluation(id);
    if (!evaluation) throw new GovernanceError('EVALUATION_NOT_FOUND', 'Evaluation not found', 404);
    const updated = await this.repository.updateEvaluation(id, {
      legalHold: Boolean(enabled),
      legalHoldReason: nonEmpty(reason, 'reason'),
      updatedAt: this.now(),
    });
    await this.audit('EVALUATION', id, enabled ? 'LEGAL_HOLD_APPLIED' : 'LEGAL_HOLD_RELEASED', actor, { reason });
    return updated;
  }

  async exportDecision(id, actor) {
    const evaluation = await this.repository.getEvaluation(id);
    if (!evaluation) throw new GovernanceError('EVALUATION_NOT_FOUND', 'Evaluation not found', 404);
    const auditEvents = await this.repository.listAudit(id);
    const chainValid = auditEvents.every((event, index) => {
      const previousHash = index ? auditEvents[index - 1].hash : 'GENESIS';
      return event.previousHash === previousHash
        && event.sequence === index + 1
        && event.hash === digest({ previousHash, record: governanceAuditRecord(event) });
    });
    if (!chainValid) throw new GovernanceError('AUDIT_CHAIN_INVALID', 'Audit chain verification failed', 500);
    return {
      auditEvents,
      evaluation,
      exportedAt: this.now(),
      exportedBy: actor.id,
      manifestHash: digest({ auditEvents, evaluation }),
    };
  }
}

module.exports = {
  ComplianceDecisionService,
  GovernanceError,
  InMemoryGovernanceRepository,
  digest,
  governanceAuditRecord,
};
