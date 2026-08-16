'use strict';

const crypto = require('node:crypto');

const SOURCE_PROJECTS = Object.freeze([
  { project: 'government_contracts_v2', disposition: 'DESTINATION', note: 'Authoritative consolidated application and governed data model.' },
  { project: 'AIContractLifecycleManager', disposition: 'DEDUPLICATED', note: 'Lifecycle, clauses, obligations, amendments, approvals, renewals, audit evidence, and integrations were already consolidated.' },
  { project: 'AIContractNegotiationAssistant', disposition: 'MERGED_UNIQUE', note: 'Negotiation rounds, redlines, benchmarks, precedents, playbooks, and controlled deal-room work.' },
  { project: 'AISmartContractAuditor', disposition: 'MERGED_UNIQUE', note: 'Multichain audit, vulnerability remediation, formal verification, coverage, gas, oracle, upgrade, and deployment monitoring.' },
  { project: 'AISportsAgentContractAnalyzer', disposition: 'MERGED_UNIQUE', note: 'Athlete valuation, salary-cap, trade, endorsement, injury-impact, league-rule, and multi-party scenarios.' },
  { project: 'ai-vendor-contract-risk-monitor', disposition: 'MERGED_UNIQUE', note: 'Vendor inventory, privacy, resilience, security, regulatory exposure, renewals, and executive briefings.' },
  { project: 'government_contracts', disposition: 'MERGED_UNIQUE', note: 'Acquisition qualification, compliance matrices, capture planning, readiness, reviews, handoff, and debrief learning.' },
  { project: 'smart-contract-work', disposition: 'EXCLUDED_QUARANTINE', note: 'Frozen historical archive; no code, credentials, ABIs, provider connections, wallet actions, or assets were reused.' },
]);

const DOMAINS = Object.freeze([
  {
    slug: 'acquisition', key: 'ACQUISITION', label: 'Acquisition Operations', sourceProject: 'government_contracts',
    description: 'Capture, qualification, proposal readiness, submission controls, award handoff, and debrief learning without duplicating search or RFP generation.',
    capabilities: [
      ['opportunity-qualification', 'Opportunity Qualification'], ['compliance-matrix', 'Compliance Matrix'], ['proposal-volume-plan', 'Proposal Volume Planning'],
      ['past-performance-match', 'Past Performance Matching'], ['teaming-partners', 'Teaming Partner Tracking'], ['pricing-strategy', 'Pricing Strategy'],
      ['subcontractor-flowdowns', 'Subcontractor Flow-downs'], ['sam-uei-readiness', 'SAM / UEI Readiness'], ['certifications', 'Certification Tracking'],
      ['qa-amendment-monitor', 'Q&A and Amendment Monitoring'], ['color-team-review', 'Color Team Reviews'], ['submission-checklist', 'Submission Checklist'],
      ['win-themes', 'Win Theme Development'], ['award-handoff', 'Contract Award Handoff'], ['debrief-analysis', 'Debrief Analysis'],
    ],
  },
  {
    slug: 'negotiation', key: 'NEGOTIATION', label: 'Negotiation Intelligence', sourceProject: 'AIContractNegotiationAssistant',
    description: 'Governed negotiation rounds, clause deltas, market evidence, precedents, fallback positions, and deal-room decisions.',
    capabilities: [
      ['negotiation-round', 'Negotiation Rounds'], ['redline-review', 'Redline Review'], ['market-benchmark', 'Market Benchmarking'],
      ['precedent-analysis', 'Precedent Analysis'], ['fallback-matrix', 'Fallback Clause Matrix'], ['playbook-strategy', 'Negotiation Playbooks'],
      ['plain-language', 'Plain-Language Translation'], ['lease-analysis', 'Lease Analysis'], ['nda-generation', 'NDA Generation'],
      ['regulatory-alert', 'Regulatory Change Alerts'], ['deal-room', 'Controlled Deal Room'], ['signature-readiness', 'E-signature Readiness'],
    ],
  },
  {
    slug: 'vendor-risk', key: 'VENDOR_RISK', label: 'Vendor Risk', sourceProject: 'ai-vendor-contract-risk-monitor',
    description: 'Third-party commercial, privacy, resilience, cybersecurity, regulatory, and renewal risk with accountable owner actions.',
    capabilities: [
      ['vendor-inventory', 'Vendor Inventory'], ['renewal-risk', 'Renewal Risk'], ['data-processing-terms', 'Data Processing Terms'],
      ['ai-act-exposure', 'AI Act Exposure'], ['dora-nis2-mapping', 'DORA / NIS2 Mapping'], ['security-obligations', 'Security Obligations'],
      ['exception-control', 'Risk Exception Controls'], ['vendor-briefing', 'Executive Vendor Briefings'],
    ],
  },
  {
    slug: 'smart-contract', key: 'SMART_CONTRACT', label: 'Smart-Contract Assurance', sourceProject: 'AISmartContractAuditor',
    description: 'Clean-room, read-only assurance for approved source artifacts; no wallet, signing, transaction submission, or quarantined archive reuse.',
    capabilities: [
      ['source-audit', 'Source Audit'], ['vulnerability-remediation', 'Vulnerability Remediation'], ['formal-verification', 'Formal Verification'],
      ['test-coverage', 'Test Generation and Coverage'], ['gas-simulation', 'Gas Optimization Simulation'], ['multichain-analysis', 'Multichain Analysis'],
      ['deployed-monitoring', 'Deployed Contract Monitoring'], ['upgrade-advisor', 'Upgrade Path Advisor'], ['oracle-risk', 'Oracle Dependency Risk'],
      ['fork-comparison', 'Fork and Pattern Comparison'], ['deployment-cost', 'Deployment Cost Estimation'], ['notification-routing', 'Finding Notifications'],
    ],
  },
  {
    slug: 'sports', key: 'SPORTS', label: 'Sports Contracts', sourceProject: 'AISportsAgentContractAnalyzer',
    description: 'Player, team, league, endorsement, injury, cap, and trade scenarios separated from general commercial negotiation records.',
    capabilities: [
      ['player-valuation', 'Player Valuation'], ['salary-cap', 'Salary Cap Modeling'], ['trade-scenario', 'Trade Scenarios'],
      ['injury-impact', 'Injury and Performance Impact'], ['endorsement-match', 'Endorsement Matching'], ['league-rules', 'League Rule Mapping'],
      ['multi-party-negotiation', 'Multi-party Negotiation'], ['escrow-holdback', 'Escrow and Holdback Tracking'],
      ['draft-scouting', 'Draft and Free-Agent Scouting'], ['contract-comparables', 'Contract Comparables'],
    ],
  },
]);

const DOMAIN_BY_SLUG = new Map(DOMAINS.map(domain => [domain.slug, domain]));
const DOMAIN_BY_KEY = new Map(DOMAINS.map(domain => [domain.key, domain]));
const TRANSITIONS = Object.freeze({
  OPEN: ['IN_REVIEW', 'BLOCKED'], IN_REVIEW: ['DECISION_REQUIRED', 'BLOCKED'], BLOCKED: ['IN_REVIEW'],
  DECISION_REQUIRED: ['APPROVED', 'BLOCKED'], APPROVED: ['CLOSED'], CLOSED: [],
});

class ContractSuiteError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new ContractSuiteError('REQUIRED_FIELD', `${field} is required`);
  return value.trim();
}
function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ContractSuiteError('INVALID_DATE', `${field} must be an ISO date`);
  return date;
}
function optionalProbability(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new ContractSuiteError('INVALID_PROBABILITY', 'probability must be between 0 and 1');
  return number;
}
function parseStructuredOutput(raw) {
  const cleaned = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch (_error) { throw new ContractSuiteError('AI_INVALID_RESPONSE', 'AI provider did not return the required structured report', 502); }
  parsed = parsed.report || parsed.analysis || parsed.result || parsed;
  const normalized = {
    summary: parsed.summary || parsed.executiveSummary || parsed.executive_summary,
    executiveDecision: parsed.executiveDecision || parsed.executive_decision || null,
    scenarioMetrics: parsed.scenarioMetrics || parsed.scenario_metrics || parsed.metrics || [],
    riskAssessment: parsed.riskAssessment || parsed.risk_assessment || parsed.risks,
    evidenceGaps: parsed.evidenceGaps || parsed.evidence_gaps || parsed.missingEvidence,
    controls: parsed.controls || parsed.controlChecks || parsed.control_checks || [],
    recommendations: parsed.recommendations || parsed.recommendedActions || parsed.recommended_actions,
    humanDecision: parsed.humanDecision || parsed.human_decision || parsed.decisionGate || parsed.decision_gate,
  };
  for (const field of ['summary', 'riskAssessment', 'evidenceGaps', 'recommendations', 'humanDecision']) {
    if (!normalized[field]) throw new ContractSuiteError('AI_INVALID_RESPONSE', `AI report is missing ${field}`, 502);
  }
  if (!Array.isArray(normalized.riskAssessment) || !Array.isArray(normalized.evidenceGaps) || !Array.isArray(normalized.recommendations) || !Array.isArray(normalized.controls) || !Array.isArray(normalized.scenarioMetrics)) {
    throw new ContractSuiteError('AI_INVALID_RESPONSE', 'AI report list sections are invalid', 502);
  }
  if (!normalized.executiveDecision || typeof normalized.executiveDecision !== 'object') normalized.executiveDecision = {
    recommendation: normalized.humanDecision,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 'Requires human validation',
    rationale: normalized.summary,
  };
  return normalized;
}

function reviewContext(input, record) {
  const list = (value, fallback) => Array.isArray(value) && value.some(item => String(item).trim()) ? value.map(item => String(item).trim()).filter(Boolean) : fallback;
  return {
    analysisType: text(input.analysisType || `${record.domain}_ADVISORY_REVIEW`, 'analysisType').slice(0, 120),
    objective: text(input.objective || input.question, 'objective').slice(0, 4000),
    audience: text(input.audience || 'Contract owner, domain specialist, legal/compliance reviewer, and independent approver', 'audience').slice(0, 1000),
    riskTolerance: text(input.riskTolerance || 'Conservative; escalate unresolved high and critical findings', 'riskTolerance').slice(0, 1000),
    focusAreas: list(input.focusAreas, [record.capability]),
    assumptions: text(input.assumptions || 'Treat missing information as an evidence gap and do not infer approval or authority.', 'assumptions').slice(0, 4000),
    evidenceRequirements: text(input.evidenceRequirements || 'Cite supplied evidence for every material conclusion.', 'evidenceRequirements').slice(0, 4000),
    jurisdiction: text(input.jurisdiction || record.jurisdiction || 'Applicable jurisdiction requires confirmation', 'jurisdiction').slice(0, 1000),
    deadline: text(input.deadline || (record.dueDate ? record.dueDate.toISOString() : 'No fixed external deadline; use a 30-day review window'), 'deadline').slice(0, 1000),
    financialThreshold: text(input.financialThreshold || (record.monetaryValue ? String(record.monetaryValue) : 'Any critical exposure is material'), 'financialThreshold').slice(0, 1000),
    outputTone: text(input.outputTone || 'Executive, precise, evidence-based, and action-oriented', 'outputTone').slice(0, 1000),
    requestedSections: list(input.requestedSections, ['Executive decision', 'Key metrics', 'Risk assessment', 'Evidence gaps', 'Control checks', 'Recommended actions', 'Human decision gate']),
  };
}

function catalogResponse() {
  return {
    domains: DOMAINS.map(domain => ({ ...domain, capabilities: domain.capabilities.map(([key, label]) => ({ key, label })) })),
    sources: SOURCE_PROJECTS,
    duplicatePolicy: 'One governed work-item and evidence model is shared across domains; existing lifecycle, RFP, clause, approval, renewal, document, and governance features are referenced instead of recreated.',
  };
}

class ContractSuiteService {
  constructor(prisma, { clock = () => new Date(), fetchImpl = global.fetch, environment = process.env, lifecycleAudit } = {}) {
    this.prisma = prisma; this.clock = clock; this.fetch = fetchImpl; this.environment = environment; this.lifecycleAudit = lifecycleAudit;
  }

  domain(value) {
    const domain = DOMAIN_BY_SLUG.get(String(value || '').toLowerCase()) || DOMAIN_BY_KEY.get(String(value || '').toUpperCase());
    if (!domain) throw new ContractSuiteError('DOMAIN_NOT_FOUND', 'Unknown contract capability domain', 404);
    return domain;
  }

  capability(domain, value) {
    const capability = domain.capabilities.find(([key]) => key === value);
    if (!capability) throw new ContractSuiteError('CAPABILITY_NOT_FOUND', `Unknown capability for ${domain.label}`, 404);
    return capability;
  }

  async overview() {
    const [domainCounts, statusCounts, highRisk, dueSoon, pendingHumanReview, total] = await Promise.all([
      this.prisma.contractCapabilityWorkItem.groupBy({ by: ['domain'], _count: { _all: true } }),
      this.prisma.contractCapabilityWorkItem.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.contractCapabilityWorkItem.count({ where: { riskLevel: { in: ['HIGH', 'CRITICAL'] }, status: { not: 'CLOSED' } } }),
      this.prisma.contractCapabilityWorkItem.count({ where: { dueDate: { gte: this.clock(), lte: new Date(this.clock().getTime() + 30 * 86400000) }, status: { not: 'CLOSED' } } }),
      this.prisma.contractCapabilityAnalysis.count({ where: { status: 'PENDING_HUMAN_REVIEW' } }),
      this.prisma.contractCapabilityWorkItem.count(),
    ]);
    return {
      total, highRisk, dueSoon, pendingHumanReview,
      domains: Object.fromEntries(DOMAINS.map(domain => [domain.key, domainCounts.find(item => item.domain === domain.key)?._count._all || 0])),
      statuses: Object.fromEntries(statusCounts.map(item => [item.status, item._count._all])),
    };
  }

  async list({ domain: domainValue, capability, status, search, limit = 200 } = {}) {
    const where = {};
    if (domainValue) where.domain = this.domain(domainValue).key;
    if (capability) {
      const domain = this.domain(domainValue);
      this.capability(domain, capability);
      where.capability = capability;
    }
    if (status) where.status = String(status).toUpperCase();
    const records = await this.prisma.contractCapabilityWorkItem.findMany({
      where, orderBy: [{ riskLevel: 'desc' }, { dueDate: 'asc' }, { updatedAt: 'desc' }], take: Math.min(Math.max(Number(limit) || 200, 1), 200),
      include: { matter: { select: { matterNumber: true, title: true, agency: true, stage: true } }, _count: { select: { analyses: true } } },
    });
    const needle = String(search || '').trim().toLowerCase();
    if (!needle) return records;
    return records.filter(record => [record.title, record.summary, record.ownerId, record.counterparty, record.capability, record.matter?.matterNumber].some(value => String(value || '').toLowerCase().includes(needle)));
  }

  async get(id) {
    const record = await this.prisma.contractCapabilityWorkItem.findUnique({
      where: { id }, include: { matter: { select: { matterNumber: true, title: true, agency: true, stage: true } }, analyses: { orderBy: { createdAt: 'desc' } } },
    });
    if (!record) throw new ContractSuiteError('WORK_ITEM_NOT_FOUND', 'Contract capability work item not found', 404);
    return record;
  }

  async create(input, actor) {
    const domain = this.domain(input.domain);
    this.capability(domain, text(input.capability, 'capability'));
    const sourceProject = input.sourceProject || 'government_contracts_v2';
    const source = SOURCE_PROJECTS.find(item => item.project === sourceProject);
    if (!source) throw new ContractSuiteError('UNKNOWN_SOURCE', 'sourceProject is not in the consolidation register');
    if (source.disposition === 'EXCLUDED_QUARANTINE') throw new ContractSuiteError('QUARANTINED_SOURCE', 'The smart-contract-work archive is prohibited from reuse', 409);
    const matter = await this.prisma.contractMatter.findUnique({ where: { id: text(input.matterId, 'matterId') } });
    if (!matter) throw new ContractSuiteError('MATTER_NOT_FOUND', 'Contract matter not found', 404);
    const record = await this.prisma.contractCapabilityWorkItem.create({ data: {
      matterId: matter.id, domain: domain.key, capability: input.capability, sourceProject,
      sourceRecordKey: text(input.sourceRecordKey, 'sourceRecordKey'), title: text(input.title, 'title'), summary: text(input.summary, 'summary'),
      status: 'OPEN', priority: String(input.priority || 'MEDIUM').toUpperCase(), riskLevel: String(input.riskLevel || 'MEDIUM').toUpperCase(),
      ownerId: text(input.ownerId || actor.id, 'ownerId'), counterparty: input.counterparty || null, monetaryValue: input.monetaryValue == null ? null : Number(input.monetaryValue),
      probability: optionalProbability(input.probability), dueDate: optionalDate(input.dueDate, 'dueDate'), jurisdiction: input.jurisdiction || matter.jurisdiction,
      chainId: input.chainId || null, league: input.league || null, evidence: input.evidence || {}, recommendation: text(input.recommendation, 'recommendation'),
    } });
    if (this.lifecycleAudit) await this.lifecycleAudit(record.matterId, 'CAPABILITY_WORK_ITEM_CREATED', actor, { workItemId: record.id, domain: record.domain, capability: record.capability });
    return record;
  }

  async transition(id, input, actor) {
    const record = await this.get(id);
    const nextStatus = text(input.nextStatus, 'nextStatus').toUpperCase();
    if (!(TRANSITIONS[record.status] || []).includes(nextStatus)) throw new ContractSuiteError('INVALID_STATUS_TRANSITION', `Cannot transition from ${record.status} to ${nextStatus}`, 409);
    const rationale = text(input.rationale, 'rationale');
    const data = { status: nextStatus };
    if (nextStatus === 'APPROVED') { data.approvedBy = actor.id; data.approvedAt = this.clock(); }
    const updated = await this.prisma.contractCapabilityWorkItem.update({ where: { id }, data });
    if (this.lifecycleAudit) await this.lifecycleAudit(record.matterId, 'CAPABILITY_WORK_ITEM_TRANSITIONED', actor, { workItemId: id, from: record.status, to: nextStatus, rationale });
    return updated;
  }

  async aiReview(id, input, actor) {
    const record = await this.get(id);
    const question = text(input.question, 'question').slice(0, 10000);
    const context = reviewContext(input, record);
    const apiKey = this.environment.OPENROUTER_API_KEY;
    const model = this.environment.OPENROUTER_MODEL;
    const baseUrl = this.environment.OPENROUTER_BASE_URL;
    if (!apiKey || !model || !baseUrl) throw new ContractSuiteError('AI_NOT_CONFIGURED', 'OpenRouter runtime is not configured', 503);
    const governedEvidence = { workItem: { ...record, analyses: undefined }, request: { question, ...context } };
    const response = await this.fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.1, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: 'You are an advisory contract-domain reviewer. Use only supplied evidence and fill every requested report section. Return one JSON object with: summary (string); executiveDecision ({recommendation,confidence,rationale}); scenarioMetrics (array of {label,value,interpretation}); riskAssessment (array of {finding,severity,evidence}); evidenceGaps (string array); controls (array of {control,status,evidence,owner}); recommendations (array of {action,owner,priority,rationale}); and humanDecision (string). Be precise and professional. Never wrap JSON in Markdown. Never approve, sign, submit, transact, connect a wallet, or make a binding decision.' },
        { role: 'user', content: JSON.stringify(governedEvidence) },
      ] }),
    });
    if (!response.ok) throw new ContractSuiteError('AI_PROVIDER_ERROR', `OpenRouter returned ${response.status}`, 502);
    const payload = await response.json();
    const output = parseStructuredOutput(payload?.choices?.[0]?.message?.content);
    const analysis = await this.prisma.contractCapabilityAnalysis.create({ data: {
      workItemId: record.id, analysisType: context.analysisType, inputDigest: digest(governedEvidence), output,
      model, confidence: typeof output.confidence === 'number' ? output.confidence : null, advisoryOnly: true, status: 'PENDING_HUMAN_REVIEW', createdBy: actor.id,
    } });
    if (this.lifecycleAudit) await this.lifecycleAudit(record.matterId, 'CAPABILITY_AI_REVIEW_RECORDED', actor, { workItemId: id, analysisId: analysis.id, model, advisoryOnly: true });
    return analysis;
  }
}

module.exports = { ContractSuiteService, ContractSuiteError, DOMAINS, SOURCE_PROJECTS, TRANSITIONS, catalogResponse, parseStructuredOutput };
