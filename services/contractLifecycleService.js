'use strict';

const crypto = require('node:crypto');

const LIFECYCLE_STAGES = Object.freeze(['INTAKE', 'DILIGENCE', 'NEGOTIATION', 'APPROVAL', 'EXECUTION', 'PERFORMANCE', 'RENEWAL', 'CLOSEOUT']);
const RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const RESOURCE_CATALOG = Object.freeze({
  matters: { client: 'contractMatter', label: 'Contract Matters', description: 'Government awards and solicitations moving through a controlled lifecycle.', matterScoped: false, search: ['matterNumber', 'title', 'agency', 'ownerId'], orderBy: { updatedAt: 'desc' } },
  parties: { client: 'contractParty', label: 'Parties & Counterparties', description: 'Agencies, primes, subcontractors, teaming partners, and accountable roles.', matterScoped: true, search: ['name', 'partyType', 'contractRole'], orderBy: { updatedAt: 'desc' } },
  'document-versions': { client: 'contractDocumentVersion', label: 'Document Versions', description: 'Immutable, digest-pinned contracts, modifications, exhibits, and evidence.', matterScoped: true, search: ['title', 'documentType', 'privilege'], orderBy: { createdAt: 'desc' }, appendOnly: true },
  clauses: { client: 'contractClause', label: 'Clauses & Playbooks', description: 'Cited FAR/DFARS and negotiated clauses with risk and fallback positions.', matterScoped: true, search: ['clauseKey', 'title', 'category', 'citation'], orderBy: { updatedAt: 'desc' } },
  obligations: { client: 'contractObligation', label: 'Obligations', description: 'Accountable requirements, due dates, evidence, recurrence, and escalation.', matterScoped: true, search: ['reference', 'description', 'ownerId', 'status'], orderBy: { dueDate: 'asc' } },
  milestones: { client: 'contractMilestone', label: 'Milestones', description: 'Deliverables, reviews, option notices, and closeout checkpoints.', matterScoped: true, search: ['reference', 'name', 'ownerId', 'status'], orderBy: { dueDate: 'asc' } },
  amendments: { client: 'contractAmendment', label: 'Amendments & Redlines', description: 'Versioned modifications with commercial impact and negotiation risk.', matterScoped: true, search: ['amendmentNumber', 'title', 'impactSummary', 'status'], orderBy: { effectiveDate: 'desc' } },
  approvals: { client: 'contractApproval', label: 'Approvals', description: 'Append-only legal, business, security, and compliance decisions.', matterScoped: true, search: ['resourceType', 'step', 'decision', 'actorId'], orderBy: { createdAt: 'desc' }, appendOnly: true },
  renewals: { client: 'contractRenewal', label: 'Renewals & Options', description: 'Option periods, notice deadlines, value, and exercise recommendations.', matterScoped: true, search: ['optionPeriod', 'status', 'recommendation', 'ownerId'], orderBy: { noticeDeadline: 'asc' } },
  'risk-assessments': { client: 'contractRiskAssessment', label: 'Risk Assessments', description: 'Legal, financial, operational, cyber, and compliance risk evidence.', matterScoped: true, search: ['assessmentKey', 'overallRating', 'assessedBy'], orderBy: { createdAt: 'desc' }, appendOnly: true },
  templates: { client: 'contractTemplate', label: 'Templates & Playbooks', description: 'Versioned government-contract templates and approved negotiation rules.', matterScoped: false, search: ['templateKey', 'name', 'agency', 'contractType', 'status'], orderBy: { createdAt: 'desc' } },
  'ai-reviews': { client: 'contractAiReview', label: 'AI Review Evidence', description: 'Advisory-only analysis retained for accountable human disposition.', matterScoped: true, search: ['reviewType', 'model', 'status', 'createdBy'], orderBy: { createdAt: 'desc' }, appendOnly: true },
  integrations: { client: 'contractIntegrationOutbox', label: 'Integration Outbox', description: 'Idempotent provider actions with receipts, retries, and failure evidence.', matterScoped: true, search: ['provider', 'operation', 'status', 'lastErrorCode'], orderBy: { createdAt: 'desc' } },
});

class LifecycleError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => ({ ...out, [key]: stable(value[key]) }), {});
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new LifecycleError('REQUIRED_FIELD', `${field} is required`);
  return value.trim();
}

function safeDate(value, field, optional = false) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new LifecycleError('INVALID_DATE', `${field} must be an ISO date`);
  return date;
}

function assertRisk(value, field = 'riskLevel') {
  if (!RISK_LEVELS.has(value)) throw new LifecycleError('INVALID_RISK', `${field} must be LOW, MEDIUM, HIGH, or CRITICAL`);
  return value;
}

function assertTransition(current, next) {
  const currentIndex = LIFECYCLE_STAGES.indexOf(current);
  const nextIndex = LIFECYCLE_STAGES.indexOf(next);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex !== currentIndex + 1) {
    throw new LifecycleError('INVALID_STAGE_TRANSITION', `Matter cannot transition from ${current} to ${next}`, 409);
  }
  return next;
}

function catalogResponse() {
  return Object.entries(RESOURCE_CATALOG).map(([key, resource]) => ({ key, label: resource.label, description: resource.description, appendOnly: Boolean(resource.appendOnly) }));
}

class ContractLifecycleService {
  constructor(prisma, { clock = () => new Date(), fetchImpl = global.fetch, environment = process.env } = {}) {
    this.prisma = prisma;
    this.clock = clock;
    this.fetch = fetchImpl;
    this.environment = environment;
  }

  resource(name) {
    const resource = RESOURCE_CATALOG[name];
    if (!resource) throw new LifecycleError('RESOURCE_NOT_FOUND', 'Unknown lifecycle resource', 404);
    return resource;
  }

  async audit(aggregateId, action, actor, payload = {}) {
    return this.prisma.$transaction(async transaction => {
      const latest = await transaction.contractLifecycleAuditEvent.findFirst({ where: { aggregateId }, orderBy: { sequence: 'desc' } });
      const record = { aggregateId, action, actorId: requiredText(actor.id, 'actor.id'), occurredAt: this.clock(), payload };
      const previousHash = latest ? latest.hash : 'GENESIS';
      const sequence = latest ? latest.sequence + 1 : 1;
      return transaction.contractLifecycleAuditEvent.create({ data: { ...record, sequence, previousHash, hash: digest({ previousHash, sequence, ...record }) } });
    });
  }

  async overview() {
    const counts = {};
    await Promise.all(Object.entries(RESOURCE_CATALOG).map(async ([key, resource]) => { counts[key] = await this.prisma[resource.client].count(); }));
    const [activeMatters, highRiskClauses, overdueObligations, pendingApprovals, upcomingRenewals] = await Promise.all([
      this.prisma.contractMatter.count({ where: { status: 'ACTIVE' } }),
      this.prisma.contractClause.count({ where: { riskLevel: { in: ['HIGH', 'CRITICAL'] }, status: { not: 'ACCEPTED' } } }),
      this.prisma.contractObligation.count({ where: { dueDate: { lt: this.clock() }, status: { notIn: ['SATISFIED', 'WAIVED'] } } }),
      this.prisma.contractMatter.count({ where: { stage: 'APPROVAL', status: 'ACTIVE' } }),
      this.prisma.contractRenewal.count({ where: { noticeDeadline: { lte: new Date(this.clock().getTime() + 90 * 86400000) }, status: 'MONITORING' } }),
    ]);
    return { counts, metrics: { activeMatters, highRiskClauses, overdueObligations, pendingApprovals, upcomingRenewals }, stages: LIFECYCLE_STAGES };
  }

  async list(name, { matterId, search, limit = 100 } = {}) {
    const resource = this.resource(name);
    const where = resource.matterScoped && matterId ? { matterId } : {};
    const records = await this.prisma[resource.client].findMany({ where, orderBy: resource.orderBy, take: Math.min(Math.max(Number(limit) || 100, 1), 200) });
    const needle = String(search || '').trim().toLowerCase();
    if (!needle) return records;
    return records.filter(record => resource.search.some(field => String(record[field] ?? '').toLowerCase().includes(needle)));
  }

  async createMatter(input, actor) {
    const retentionUntil = safeDate(input.retentionUntil || new Date(this.clock().getTime() + 7 * 365 * 86400000), 'retentionUntil');
    const matter = await this.prisma.contractMatter.create({ data: {
      matterNumber: requiredText(input.matterNumber, 'matterNumber'), title: requiredText(input.title, 'title'),
      agency: requiredText(input.agency, 'agency'), contractType: requiredText(input.contractType, 'contractType'),
      jurisdiction: requiredText(input.jurisdiction || 'US-FEDERAL', 'jurisdiction'), ownerId: requiredText(input.ownerId, 'ownerId'),
      createdBy: actor.id, contractNoticeId: input.contractNoticeId || null, retentionUntil,
    } });
    await this.audit(matter.id, 'MATTER_CREATED', actor, { matterNumber: matter.matterNumber, stage: matter.stage });
    return matter;
  }

  async transitionMatter(id, input, actor) {
    const matter = await this.prisma.contractMatter.findUnique({ where: { id } });
    if (!matter) throw new LifecycleError('MATTER_NOT_FOUND', 'Contract matter not found', 404);
    const nextStage = assertTransition(matter.stage, input.nextStage);
    if (nextStage === 'EXECUTION') {
      const approvals = await this.prisma.contractApproval.findMany({ where: { matterId: id, decision: 'APPROVED' } });
      const steps = new Set(approvals.map(item => item.step));
      for (const required of ['LEGAL', 'BUSINESS', 'COMPLIANCE']) if (!steps.has(required)) throw new LifecycleError('APPROVALS_REQUIRED', `${required} approval is required before execution`, 409);
    }
    const updated = await this.prisma.contractMatter.update({ where: { id }, data: { stage: nextStage } });
    await this.audit(id, 'MATTER_STAGE_TRANSITIONED', actor, { from: matter.stage, to: nextStage, rationale: requiredText(input.rationale, 'rationale') });
    return updated;
  }

  async createApproval(matterId, input, actor) {
    const matter = await this.prisma.contractMatter.findUnique({ where: { id: matterId } });
    if (!matter) throw new LifecycleError('MATTER_NOT_FOUND', 'Contract matter not found', 404);
    if (actor.id === matter.createdBy || actor.id === matter.ownerId) throw new LifecycleError('SEGREGATION_OF_DUTIES', 'Matter creator and owner cannot approve their own matter', 403);
    if (!['APPROVED', 'REJECTED'].includes(input.decision)) throw new LifecycleError('INVALID_DECISION', 'Decision must be APPROVED or REJECTED');
    if (!['LEGAL', 'BUSINESS', 'COMPLIANCE', 'SECURITY'].includes(input.step)) throw new LifecycleError('INVALID_APPROVAL_STEP', 'Approval step is not recognized');
    const approval = await this.prisma.contractApproval.create({ data: {
      matterId, resourceType: input.resourceType || 'MATTER', resourceId: input.resourceId || matterId,
      step: input.step, decision: input.decision, rationale: requiredText(input.rationale, 'rationale'), actorId: actor.id,
    } });
    await this.audit(matterId, 'APPROVAL_RECORDED', actor, { approvalId: approval.id, step: approval.step, decision: approval.decision });
    return approval;
  }

  async createRecord(name, input, actor) {
    const matterId = requiredText(input.matterId, 'matterId');
    const matter = await this.prisma.contractMatter.findUnique({ where: { id: matterId } });
    if (!matter) throw new LifecycleError('MATTER_NOT_FOUND', 'Contract matter not found', 404);
    let data;
    if (name === 'parties') data = { matterId, name: requiredText(input.name, 'name'), partyType: requiredText(input.partyType, 'partyType'), contractRole: requiredText(input.contractRole, 'contractRole'), uei: input.uei || null, cageCode: input.cageCode || null, riskRating: assertRisk(input.riskRating || 'LOW'), sanctionsStatus: input.sanctionsStatus || 'CLEAR' };
    else if (name === 'document-versions') data = { matterId, documentType: requiredText(input.documentType, 'documentType'), title: requiredText(input.title, 'title'), version: Number(input.version), sourceUrl: input.sourceUrl || null, contentHash: requiredText(input.contentHash, 'contentHash'), privilege: input.privilege || 'BUSINESS_CONFIDENTIAL', effectiveDate: safeDate(input.effectiveDate, 'effectiveDate', true), uploadedBy: actor.id };
    else if (name === 'clauses') data = { matterId, documentVersionId: input.documentVersionId || null, clauseKey: requiredText(input.clauseKey, 'clauseKey'), title: requiredText(input.title, 'title'), category: requiredText(input.category, 'category'), text: requiredText(input.text, 'text'), citation: requiredText(input.citation, 'citation'), riskLevel: assertRisk(input.riskLevel || 'LOW'), status: input.status || 'IDENTIFIED', fallbackText: input.fallbackText || null, aiConfidence: input.aiConfidence ?? null };
    else if (name === 'obligations') data = { matterId, clauseId: input.clauseId || null, reference: requiredText(input.reference, 'reference'), description: requiredText(input.description, 'description'), ownerId: requiredText(input.ownerId, 'ownerId'), dueDate: safeDate(input.dueDate, 'dueDate', true), recurrence: input.recurrence || null, status: input.status || 'OPEN', evidenceUrl: input.evidenceUrl || null, escalationLevel: Number(input.escalationLevel || 0) };
    else if (name === 'milestones') data = { matterId, reference: requiredText(input.reference, 'reference'), name: requiredText(input.name, 'name'), dueDate: safeDate(input.dueDate, 'dueDate'), status: input.status || 'UPCOMING', ownerId: requiredText(input.ownerId, 'ownerId'), evidenceUrl: input.evidenceUrl || null };
    else if (name === 'amendments') data = { matterId, documentVersionId: input.documentVersionId || null, amendmentNumber: requiredText(input.amendmentNumber, 'amendmentNumber'), title: requiredText(input.title, 'title'), description: requiredText(input.description, 'description'), effectiveDate: safeDate(input.effectiveDate, 'effectiveDate'), priceDelta: Number(input.priceDelta || 0), impactSummary: requiredText(input.impactSummary, 'impactSummary'), riskLevel: assertRisk(input.riskLevel || 'MEDIUM'), status: input.status || 'DRAFT', createdBy: actor.id };
    else if (name === 'renewals') data = { matterId, optionPeriod: requiredText(input.optionPeriod, 'optionPeriod'), noticeDeadline: safeDate(input.noticeDeadline, 'noticeDeadline'), exerciseDeadline: safeDate(input.exerciseDeadline, 'exerciseDeadline'), estimatedValue: Number(input.estimatedValue || 0), status: input.status || 'MONITORING', recommendation: requiredText(input.recommendation, 'recommendation'), ownerId: requiredText(input.ownerId, 'ownerId') };
    else throw new LifecycleError('WRITE_NOT_SUPPORTED', 'Use the governed workflow for this resource', 405);
    const record = await this.prisma[this.resource(name).client].create({ data });
    await this.audit(matterId, `${name.toUpperCase().replace(/-/g, '_')}_CREATED`, actor, { recordId: record.id });
    return record;
  }

  async aiReview(matterId, input, actor) {
    const matter = await this.prisma.contractMatter.findUnique({ where: { id: matterId }, include: { clauses: true, obligations: true, amendments: true, renewals: true, riskAssessments: true } });
    if (!matter) throw new LifecycleError('MATTER_NOT_FOUND', 'Contract matter not found', 404);
    const apiKey = this.environment.OPENROUTER_API_KEY;
    const model = this.environment.OPENROUTER_MODEL;
    const baseUrl = this.environment.OPENROUTER_BASE_URL;
    if (!apiKey || !model || !baseUrl) throw new LifecycleError('AI_NOT_CONFIGURED', 'OpenRouter runtime is not configured', 503);
    const question = requiredText(input.question, 'question').slice(0, 10000);
    const evidence = { matter: { matterNumber: matter.matterNumber, title: matter.title, agency: matter.agency, stage: matter.stage }, clauses: matter.clauses, obligations: matter.obligations, amendments: matter.amendments, renewals: matter.renewals, riskAssessments: matter.riskAssessments };
    const response = await this.fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, temperature: 0.1, messages: [
      { role: 'system', content: 'You are an advisory government-contract lifecycle reviewer. Ground every finding in the supplied record, identify evidence gaps, cite record references, distinguish FAR/DFARS compliance from commercial advice, and require authorized human review. Never approve, sign, submit, or commit the government or contractor.' },
      { role: 'user', content: `Question: ${question}\n\nGoverned matter evidence:\n${JSON.stringify(evidence)}` },
    ] }) });
    if (!response.ok) throw new LifecycleError('AI_PROVIDER_ERROR', `OpenRouter returned ${response.status}`, 502);
    const payload = await response.json();
    const output = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!output) throw new LifecycleError('AI_EMPTY_RESPONSE', 'OpenRouter returned an empty response', 502);
    const review = await this.prisma.contractAiReview.create({ data: { matterId, reviewType: input.reviewType || 'LIFECYCLE_READINESS', promptDigest: digest(question), output, model, citations: matter.clauses.map(clause => ({ clauseKey: clause.clauseKey, citation: clause.citation })), advisoryOnly: true, status: 'PENDING_HUMAN_REVIEW', createdBy: actor.id } });
    await this.audit(matterId, 'AI_REVIEW_RECORDED', actor, { reviewId: review.id, model, advisoryOnly: true });
    return review;
  }

  async auditExport(matterId, actor) {
    const matter = await this.prisma.contractMatter.findUnique({ where: { id: matterId }, include: { parties: true, documentVersions: true, clauses: true, obligations: true, milestones: true, amendments: true, approvals: true, renewals: true, riskAssessments: true, aiReviews: true, integrationOutbox: true } });
    if (!matter) throw new LifecycleError('MATTER_NOT_FOUND', 'Contract matter not found', 404);
    const events = await this.prisma.contractLifecycleAuditEvent.findMany({ where: { aggregateId: matterId }, orderBy: { sequence: 'asc' } });
    const chainValid = events.every((event, index) => {
      const previousHash = index ? events[index - 1].hash : 'GENESIS';
      return event.previousHash === previousHash && event.sequence === index + 1 && event.hash === digest({ previousHash, sequence: event.sequence, aggregateId: event.aggregateId, action: event.action, actorId: event.actorId, occurredAt: event.occurredAt, payload: event.payload });
    });
    if (!chainValid) throw new LifecycleError('AUDIT_CHAIN_INVALID', 'Lifecycle audit chain verification failed', 500);
    const bundle = { matter, events, exportedAt: this.clock(), exportedBy: actor.id };
    return { ...bundle, manifestHash: digest(bundle) };
  }
}

module.exports = { ContractLifecycleService, LifecycleError, LIFECYCLE_STAGES, RESOURCE_CATALOG, assertTransition, catalogResponse, digest };
