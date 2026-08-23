'use strict';

const crypto = require('crypto');
const { currentTenantId } = require('./tenantContext');
const config = require('../config/env');
const { SubmissionPackageService } = require('./submissionPackageService');
const { NotificationService } = require('./notificationService');

const APPROVAL_GATES = ['CONTENT', 'COMPLIANCE', 'EXECUTIVE', 'SUBMISSION'];
const CHECKLIST = [
  ['content_review', 'All proposal sections completed and reviewed'],
  ['requirements_verified', 'Solicitation requirements matrix verified'],
  ['pricing_approved', 'Pricing and representations approved'],
  ['attachments_confirmed', 'Required attachments included'],
  ['destination_verified', 'Submission destination and deadline verified'],
];

function actorId(user) {
  return String(user?.email || user?.id || 'authenticated-user');
}

function json(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function digest(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function flattenStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach(item => flattenStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => flattenStrings(item, output));
  return output;
}

function requirementSentences(value) {
  const seen = new Set();
  return flattenStrings(value)
    .flatMap(text => text.split(/(?:\r?\n)+|(?<=[.!?;])\s+/))
    .map(text => text.replace(/\s+/g, ' ').trim())
    .filter(text => text.length >= 20 && text.length <= 2000)
    .filter(text => /\b(shall|must|required|requirement|will provide|is to provide|no later than)\b/i.test(text))
    .filter(text => {
      const key = text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mapRequirement(text, sections) {
  const words = new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) || []);
  let best = null;
  let score = 0;
  for (const section of sections) {
    const candidate = [section.title, section.description, ...(section.mappings || [])].join(' ').toLowerCase();
    const candidateWords = new Set(candidate.match(/[a-z0-9]{4,}/g) || []);
    const overlap = [...words].filter(word => candidateWords.has(word)).length;
    if (overlap > score) { best = section.id; score = overlap; }
  }
  return score > 0 ? best : null;
}

function opportunitySnapshot(contract) {
  const sam = contract?.samData && typeof contract.samData === 'object' ? contract.samData : {};
  return {
    title: contract?.title || null,
    descriptionHash: digest(contract?.description || ''),
    agency: contract?.agency || null,
    naicsCode: contract?.naicsCode || null,
    classificationCode: contract?.classificationCode || null,
    setAsideCode: contract?.setAsideCode || null,
    postedDate: contract?.postedDate ? new Date(contract.postedDate).toISOString() : null,
    responseDeadline: contract?.responseDeadline ? new Date(contract.responseDeadline).toISOString() : sam.responseDeadLine || sam.responseDeadline || null,
    placeOfPerformance: contract?.placeOfPerformance || sam.placeOfPerformance || null,
    resourceLinks: [...new Set(Array.isArray(contract?.resourceLinks) ? contract.resourceLinks : [])].sort(),
  };
}

function amendmentChanges(previous, current) {
  return Object.keys(current).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(current[key])).map(key => ({
    field: key,
    previous: previous[key],
    current: current[key],
  }));
}

function affectedSections(changes) {
  const fields = new Set(changes.map(change => change.field));
  const sections = new Set();
  if (fields.has('responseDeadline') || fields.has('postedDate')) sections.add('schedule_milestones');
  if (fields.has('placeOfPerformance')) { sections.add('technical_approach'); sections.add('management_approach'); }
  if (fields.has('setAsideCode') || fields.has('naicsCode')) { sections.add('executive_summary'); sections.add('compliance'); }
  if (fields.has('descriptionHash') || fields.has('resourceLinks') || fields.has('title')) sections.add('*');
  return [...sections];
}

class RfpProductionService {
  constructor(prisma) { this.prisma = prisma; this.notifications = new NotificationService({ prisma }); }

  async audit(rfpResponseId, action, user, payload = {}) {
    return this.prisma.$transaction(async tx => {
      const latest = await tx.rfpAuditEvent.findFirst({ where: { rfpResponseId }, orderBy: { sequence: 'desc' } });
      const sequence = (latest?.sequence || 0) + 1;
      const occurredAt = new Date();
      const previousHash = latest?.hash || 'GENESIS';
      const body = { rfpResponseId, sequence, action, actorId: actorId(user), occurredAt: occurredAt.toISOString(), payload, previousHash };
      return tx.rfpAuditEvent.create({ data: { ...body, occurredAt, hash: digest(body) } });
    });
  }

  async ensureControls(rfpResponseId, user) {
    const result = await this.prisma.rfpSubmissionChecklistItem.createMany({
      data: CHECKLIST.map(([itemKey, label]) => ({ rfpResponseId, itemKey, label })),
      skipDuplicates: true,
    });
    if (result.count) {
      await this.audit(rfpResponseId, 'SUBMISSION_CONTROLS_INITIALIZED', user, { checklistItems: result.count });
    }
  }

  async workspace(rfpResponseId) {
    const response = await this.prisma.rfpResponse.findUnique({
      where: { id: rfpResponseId },
      include: {
        requirements: { orderBy: { createdAt: 'asc' } },
        collaborators: { orderBy: { createdAt: 'asc' } },
        approvals: { orderBy: [{ gate: 'asc' }, { cycle: 'desc' }] },
        checklistItems: { orderBy: { createdAt: 'asc' } },
        submission: true,
        outcome: true,
        versions: { orderBy: { versionNumber: 'desc' } },
        bidScores: { orderBy: { createdAt: 'desc' }, take: 10, include: { model: true } },
        auditEvents: { orderBy: { sequence: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!response) throw Object.assign(new Error('RFP response not found'), { statusCode: 404 });
    return response;
  }

  async syncRequirements(rfpResponseId, user) {
    const response = await this.prisma.rfpResponse.findUnique({ where: { id: rfpResponseId }, include: { template: true, contract: true } });
    if (!response) throw Object.assign(new Error('RFP response not found'), { statusCode: 404 });
    const template = response.template ? json(response.template.sections, []) : [];
    const documents = await this.prisma.documentProcessingQueue.findMany({
      where: { contractNoticeId: response.contractId, status: 'completed', processedData: { not: null } },
      orderBy: { completedAt: 'asc' },
    });
    const sources = documents.map(document => ({
      type: 'SOLICITATION_ATTACHMENT', locator: document.filename || document.documentUrl,
      refs: [{ queueId: document.id, url: document.documentUrl, checksum: document.contentChecksum }],
      value: json(document.processedData, document.processedData),
    }));
    if (response.contract?.description) sources.push({
      type: 'SAM_METADATA', locator: `SAM.gov notice ${response.contractId}`,
      refs: [{ noticeId: response.contractId }], value: response.contract.description,
    });
    const requirements = [];
    for (const source of sources) {
      for (const text of requirementSentences(source.value)) {
        const requirementKey = digest(`${source.locator}:${text}`).slice(0, 24);
        const mappedSectionId = mapRequirement(text, template);
        requirements.push({
          rfpResponseId, requirementKey, text, sourceType: source.type, sourceLocator: source.locator,
          evidenceRefs: source.refs, mappedSectionId, coverageStatus: mappedSectionId ? 'PARTIAL' : 'UNMAPPED', reviewStatus: 'PENDING',
        });
      }
    }
    for (const requirement of requirements) {
      await this.prisma.rfpRequirement.upsert({
        where: { rfpResponseId_requirementKey: { rfpResponseId, requirementKey: requirement.requirementKey } },
        create: requirement,
        update: {
          text: requirement.text,
          sourceType: requirement.sourceType,
          sourceLocator: requirement.sourceLocator,
          evidenceRefs: requirement.evidenceRefs,
        },
      });
    }
    await this.audit(rfpResponseId, 'REQUIREMENTS_SYNCHRONIZED', user, { sourceDocuments: documents.length, requirements: requirements.length });
    return this.prisma.rfpRequirement.findMany({ where: { rfpResponseId }, orderBy: { createdAt: 'asc' } });
  }

  async updateRequirement(rfpResponseId, requirementId, input, user) {
    const existing = await this.prisma.rfpRequirement.findFirst({ where: { id: requirementId, rfpResponseId } });
    if (!existing) throw Object.assign(new Error('Requirement not found'), { statusCode: 404 });
    const coverageStatus = input.coverageStatus || existing.coverageStatus;
    const reviewStatus = input.reviewStatus || existing.reviewStatus;
    if (!['UNMAPPED', 'PARTIAL', 'COVERED', 'NOT_APPLICABLE'].includes(coverageStatus)) throw Object.assign(new Error('Invalid coverage status'), { statusCode: 400 });
    if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(reviewStatus)) throw Object.assign(new Error('Invalid review status'), { statusCode: 400 });
    const requirement = await this.prisma.rfpRequirement.update({ where: { id: requirementId }, data: { coverageStatus, reviewStatus, mappedSectionId: input.mappedSectionId ?? existing.mappedSectionId } });
    await this.audit(rfpResponseId, 'REQUIREMENT_REVIEWED', user, { requirementId, coverageStatus, reviewStatus, mappedSectionId: requirement.mappedSectionId });
    return requirement;
  }

  async createVersion(rfpResponseId, comment, user) {
    const response = await this.prisma.rfpResponse.findUnique({ where: { id: rfpResponseId } });
    if (!response) throw Object.assign(new Error('RFP response not found'), { statusCode: 404 });
    const latest = await this.prisma.rfpVersion.aggregate({ where: { rfpResponseId }, _max: { versionNumber: true } });
    const snapshot = { title: response.title, status: response.status, responseData: json(response.responseData), complianceStatus: json(response.complianceStatus), predictedScore: response.predictedScore };
    const version = await this.prisma.rfpVersion.create({ data: { rfpResponseId, versionNumber: (latest._max.versionNumber || 0) + 1, changes: JSON.stringify({ comment: comment || 'Manual snapshot' }), snapshot: JSON.stringify(snapshot), comment: comment || null, createdBy: actorId(user) } });
    await this.audit(rfpResponseId, 'VERSION_CREATED', user, { versionId: version.id, versionNumber: version.versionNumber, comment });
    return version;
  }

  async compareVersions(rfpResponseId, leftId, rightId) {
    leftId = Number(leftId); rightId = Number(rightId);
    if (!Number.isSafeInteger(leftId) || !Number.isSafeInteger(rightId) || leftId === rightId) {
      throw Object.assign(new Error('Two different version IDs are required'), { statusCode: 400 });
    }
    const versions = await this.prisma.rfpVersion.findMany({ where: { rfpResponseId, id: { in: [leftId, rightId] } } });
    if (versions.length !== 2) throw Object.assign(new Error('Both versions are required'), { statusCode: 404 });
    const [left, right] = [versions.find(item => item.id === leftId), versions.find(item => item.id === rightId)];
    const a = json(left.snapshot, {}); const b = json(right.snapshot, {});
    const aSections = a.responseData?.sections || []; const bSections = b.responseData?.sections || [];
    const ids = [...new Set([...aSections, ...bSections].map(section => section.sectionId || section.id))];
    return { left: left.versionNumber, right: right.versionNumber, sections: ids.map(id => { const before = aSections.find(section => (section.sectionId || section.id) === id); const after = bSections.find(section => (section.sectionId || section.id) === id); return { sectionId: id, title: after?.title || before?.title || id, changed: before?.content !== after?.content, beforeWords: before?.wordCount || 0, afterWords: after?.wordCount || 0 }; }) };
  }

  async restoreVersion(rfpResponseId, versionId, user) {
    versionId = Number(versionId);
    const [response, version] = await Promise.all([this.prisma.rfpResponse.findUnique({ where: { id: rfpResponseId } }), this.prisma.rfpVersion.findFirst({ where: { id: versionId, rfpResponseId } })]);
    if (!response || !version) throw Object.assign(new Error('RFP response or version not found'), { statusCode: 404 });
    if (response.status === 'submitted') throw Object.assign(new Error('Submitted proposals cannot be restored'), { statusCode: 409 });
    const snapshot = json(version.snapshot, null);
    if (!snapshot) throw Object.assign(new Error('This legacy version has no restorable snapshot'), { statusCode: 409 });
    const restored = await this.prisma.rfpResponse.update({ where: { id: rfpResponseId }, data: { title: snapshot.title, status: 'draft', responseData: JSON.stringify(snapshot.responseData), complianceStatus: JSON.stringify(snapshot.complianceStatus), predictedScore: snapshot.predictedScore } });
    await this.createVersion(rfpResponseId, `Restored from version ${version.versionNumber}`, user);
    await this.audit(rfpResponseId, 'VERSION_RESTORED', user, { versionId, versionNumber: version.versionNumber });
    return restored;
  }

  async assignCollaborator(rfpResponseId, input, user) {
    const email = String(input.email || '').trim().toLowerCase(); const role = String(input.role || '').toLowerCase();
    if (!email || !['viewer', 'author', 'reviewer', 'approver'].includes(role)) throw Object.assign(new Error('Valid email and collaborator role are required'), { statusCode: 400 });
    const collaborator = await this.prisma.rfpCollaborator.upsert({ where: { rfpResponseId_email: { rfpResponseId, email } }, create: { rfpResponseId, email, role, assignedBy: actorId(user) }, update: { role, assignedBy: actorId(user) } });
    await this.audit(rfpResponseId, 'COLLABORATOR_ASSIGNED', user, { email, role });
    await this.notifications.emit({ tenantId: currentTenantId() || config.defaultTenantId, ownerId: email, eventType: 'REVIEW_ASSIGNED', subject: `Proposal ${rfpResponseId}: ${role} assignment`, payload: { rfpResponseId, role, assignedBy: actorId(user), message: `You were assigned as ${role} for proposal ${rfpResponseId}.` } });
    return collaborator;
  }

  async removeCollaborator(rfpResponseId, email, user) {
    await this.prisma.rfpCollaborator.delete({ where: { rfpResponseId_email: { rfpResponseId, email: String(email).toLowerCase() } } });
    await this.audit(rfpResponseId, 'COLLABORATOR_REMOVED', user, { email });
  }

  async addComment(rfpResponseId, input, user) {
    const body = String(input.body || '').trim();
    if (!body) throw Object.assign(new Error('Comment body is required'), { statusCode: 400 });
    const comment = await this.prisma.rfpComment.create({ data: { rfpResponseId, sectionId: input.sectionId || null, body, authorId: actorId(user) } });
    await this.audit(rfpResponseId, 'COMMENT_ADDED', user, { commentId: comment.id, sectionId: comment.sectionId });
    return comment;
  }

  async resolveComment(rfpResponseId, commentId, user) {
    const comment = await this.prisma.rfpComment.findFirst({ where: { id: commentId, rfpResponseId } });
    if (!comment) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
    const resolved = await this.prisma.rfpComment.update({ where: { id: commentId }, data: { resolved: true, resolvedBy: actorId(user), resolvedAt: new Date() } });
    await this.audit(rfpResponseId, 'COMMENT_RESOLVED', user, { commentId });
    return resolved;
  }

  async assignApproval(rfpResponseId, input, user) {
    const gate = String(input.gate || '').toUpperCase(); const reviewerEmail = String(input.reviewerEmail || '').trim().toLowerCase();
    if (!APPROVAL_GATES.includes(gate) || !reviewerEmail) throw Object.assign(new Error('Valid approval gate and reviewer email are required'), { statusCode: 400 });
    const existing = await this.prisma.rfpApproval.findFirst({ where: { rfpResponseId, gate }, orderBy: { cycle: 'desc' } });
    const cycle = existing && existing.decision !== 'PENDING' ? existing.cycle + 1 : existing?.cycle || 1;
    const approval = existing && existing.decision === 'PENDING'
      ? await this.prisma.rfpApproval.update({ where: { id: existing.id }, data: { reviewerEmail, assignedBy: actorId(user) } })
      : await this.prisma.rfpApproval.create({ data: { rfpResponseId, gate, cycle, reviewerEmail, assignedBy: actorId(user) } });
    await this.audit(rfpResponseId, 'APPROVAL_ASSIGNED', user, { gate, cycle, reviewerEmail });
    return approval;
  }

  async decideApproval(rfpResponseId, approvalId, input, user) {
    const approval = await this.prisma.rfpApproval.findFirst({ where: { id: approvalId, rfpResponseId } });
    if (!approval) throw Object.assign(new Error('Approval not found'), { statusCode: 404 });
    const decision = String(input.decision || '').toUpperCase(); const rationale = String(input.rationale || '').trim();
    if (!['APPROVED', 'REJECTED'].includes(decision) || !rationale) throw Object.assign(new Error('Decision and rationale are required'), { statusCode: 400 });
    if (approval.decision !== 'PENDING') throw Object.assign(new Error('Released approval decisions are immutable'), { statusCode: 409 });
    const reviewer = actorId(user).toLowerCase();
    if (reviewer !== approval.reviewerEmail && !user?.permissions?.includes('*')) throw Object.assign(new Error('Only the assigned reviewer may release this decision'), { statusCode: 403 });
    const decided = await this.prisma.rfpApproval.update({ where: { id: approvalId }, data: { decision, rationale, decidedBy: actorId(user), decidedAt: new Date() } });
    await this.audit(rfpResponseId, 'APPROVAL_DECIDED', user, { approvalId, gate: approval.gate, decision, rationale });
    return decided;
  }

  async updateChecklist(rfpResponseId, itemId, input, user) {
    const item = await this.prisma.rfpSubmissionChecklistItem.findFirst({ where: { id: itemId, rfpResponseId } });
    if (!item) throw Object.assign(new Error('Checklist item not found'), { statusCode: 404 });
    const completed = Boolean(input.completed);
    const updated = await this.prisma.rfpSubmissionChecklistItem.update({ where: { id: itemId }, data: { completed, evidenceUrl: input.evidenceUrl || null, completedBy: completed ? actorId(user) : null, completedAt: completed ? new Date() : null } });
    await this.audit(rfpResponseId, 'CHECKLIST_UPDATED', user, { itemId, itemKey: item.itemKey, completed, evidenceUrl: updated.evidenceUrl });
    return updated;
  }

  async recordSubmission(rfpResponseId, input, user) {
    const packageValidation = await new SubmissionPackageService(this.prisma, config).validate(rfpResponseId);
    if (!packageValidation.valid && config.submissionPackageEnforcement === 'required') {
      throw Object.assign(new Error('Submission blocked: final package validation failed'), { statusCode: 409, details: { packageFindings: packageValidation.findings } });
    }
    const [response, approvals, checklist, requirements, unresolvedComments, latestVersion, latestAmendment] = await Promise.all([
      this.prisma.rfpResponse.findUnique({ where: { id: rfpResponseId } }),
      this.prisma.rfpApproval.findMany({ where: { rfpResponseId }, orderBy: [{ gate: 'asc' }, { cycle: 'desc' }] }),
      this.prisma.rfpSubmissionChecklistItem.findMany({ where: { rfpResponseId } }),
      this.prisma.rfpRequirement.findMany({ where: { rfpResponseId } }),
      this.prisma.rfpComment.count({ where: { rfpResponseId, resolved: false } }),
      this.prisma.rfpVersion.findFirst({ where: { rfpResponseId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.rfpAmendment.findFirst({ where: { contract: { rfpResponses: { some: { id: rfpResponseId } } } }, orderBy: { detectedAt: 'desc' } }),
    ]);
    if (!response) throw Object.assign(new Error('RFP response not found'), { statusCode: 404 });
    const latestApprovals = APPROVAL_GATES.map(gate => approvals.find(item => item.gate === gate)).filter(Boolean);
    const evidenceCheckpoint = [latestVersion?.createdAt, latestAmendment?.detectedAt].filter(Boolean).sort((a, b) => b - a)[0];
    const approved = new Set(latestApprovals.filter(item => item.decision === 'APPROVED' && (!evidenceCheckpoint || item.decidedAt >= evidenceCheckpoint)).map(item => item.gate));
    const missingGates = APPROVAL_GATES.filter(gate => !approved.has(gate));
    const incomplete = checklist.filter(item => item.required && !item.completed);
    const unverifiedRequirements = requirements.filter(item => !['COVERED', 'NOT_APPLICABLE'].includes(item.coverageStatus) || item.reviewStatus !== 'VERIFIED');
    const amendmentUnacknowledged = Boolean(latestAmendment && !latestAmendment.acknowledgedAt);
    if (missingGates.length || incomplete.length || unverifiedRequirements.length || unresolvedComments || amendmentUnacknowledged) throw Object.assign(new Error(`Submission blocked: governance checks remain incomplete`), { statusCode: 409, details: { missingGates, incompleteItems: incomplete.map(item => item.itemKey), unverifiedRequirements: unverifiedRequirements.map(item => item.requirementKey), unresolvedComments, amendmentUnacknowledged } });
    const destination = String(input.destination || '').trim(); const submissionMethod = String(input.submissionMethod || '').trim();
    if (!destination || !submissionMethod) throw Object.assign(new Error('Submission destination and method are required'), { statusCode: 400 });
    const submission = await this.prisma.$transaction(async tx => {
      const saved = await tx.rfpSubmission.upsert({ where: { rfpResponseId }, create: { rfpResponseId, destination, submissionMethod, trackingNumber: input.trackingNumber || null, receipt: input.receipt || undefined, submittedBy: actorId(user), submittedAt: input.submittedAt ? new Date(input.submittedAt) : new Date() }, update: { destination, submissionMethod, trackingNumber: input.trackingNumber || null, receipt: input.receipt || undefined, status: 'RECORDED', submittedBy: actorId(user), submittedAt: input.submittedAt ? new Date(input.submittedAt) : new Date() } });
      await tx.rfpResponse.update({ where: { id: rfpResponseId }, data: { status: 'submitted' } });
      return saved;
    });
    await this.audit(rfpResponseId, 'SUBMISSION_RECORDED', user, { destination, submissionMethod, trackingNumber: submission.trackingNumber, submittedAt: submission.submittedAt, packageValidation: { valid: packageValidation.valid, findings: packageValidation.findings } });
    return submission;
  }

  async recordOutcome(rfpResponseId, input, user) {
    const outcome = String(input.outcome || '').toUpperCase();
    if (!['WON', 'LOST', 'WITHDRAWN', 'NO_BID'].includes(outcome)) throw Object.assign(new Error('Outcome must be WON, LOST, WITHDRAWN, or NO_BID'), { statusCode: 400 });
    if (['WON', 'LOST'].includes(outcome)) {
      const submission = await this.prisma.rfpSubmission.findUnique({ where: { rfpResponseId } });
      if (!submission) throw Object.assign(new Error('A WON or LOST outcome requires a recorded submission'), { statusCode: 409 });
    }
    const record = await this.prisma.rfpOutcome.upsert({ where: { rfpResponseId }, create: { rfpResponseId, outcome, awardValue: input.awardValue == null ? null : Number(input.awardValue), competitor: input.competitor || null, debrief: input.debrief || null, lessonsLearned: input.lessonsLearned || [], recordedBy: actorId(user) }, update: { outcome, awardValue: input.awardValue == null ? null : Number(input.awardValue), competitor: input.competitor || null, debrief: input.debrief || null, lessonsLearned: input.lessonsLearned || [], recordedBy: actorId(user), recordedAt: new Date() } });
    await this.audit(rfpResponseId, 'OUTCOME_RECORDED', user, { outcome, awardValue: record.awardValue, competitor: record.competitor });
    return record;
  }

  async analytics() {
    const grouped = await this.prisma.rfpOutcome.groupBy({ by: ['outcome'], _count: { id: true }, _sum: { awardValue: true } });
    const counts = Object.fromEntries(grouped.map(item => [item.outcome, item._count.id]));
    const decisions = (counts.WON || 0) + (counts.LOST || 0);
    return { outcomes: counts, won: counts.WON || 0, lost: counts.LOST || 0, withdrawn: counts.WITHDRAWN || 0, noBid: counts.NO_BID || 0, winRate: decisions ? Math.round(((counts.WON || 0) / decisions) * 1000) / 10 : null, awardedValue: grouped.find(item => item.outcome === 'WON')?._sum.awardValue || 0 };
  }

  async recordBidScore({ rfpResponseId, contractId, prediction, features, user }) {
    const model = await this.prisma.rfpBidScoringModel.findFirst({ where: { status: 'VALIDATED' }, orderBy: { validatedAt: 'desc' } });
    return this.prisma.rfpBidScore.create({ data: { rfpResponseId: rfpResponseId || null, contractId, modelId: model?.id || null, probability: Number(prediction.probability), confidence: Number(prediction.confidence), advisoryOnly: !model, features: features || {}, factors: { factors: prediction.factors || [], recommendations: prediction.recommendations || [] }, createdBy: actorId(user) }, include: { model: true } });
  }

  async validateScoringModel(user) {
    const outcomes = await this.prisma.rfpOutcome.findMany({ where: { outcome: { in: ['WON', 'LOST'] } }, include: { rfpResponse: { include: { bidScores: { orderBy: { createdAt: 'desc' }, take: 1 } } } } });
    const samples = outcomes.filter(item => item.rfpResponse.bidScores[0]).map(item => ({ probability: item.rfpResponse.bidScores[0].probability / 100, actual: item.outcome === 'WON' ? 1 : 0 }));
    const brierScore = samples.length ? samples.reduce((sum, sample) => sum + ((sample.probability - sample.actual) ** 2), 0) / samples.length : null;
    const accuracy = samples.length ? samples.filter(sample => (sample.probability >= 0.5 ? 1 : 0) === sample.actual).length / samples.length : null;
    const validated = samples.length >= 30 && brierScore <= 0.25 && accuracy >= 0.6;
    const latest = await this.prisma.rfpBidScoringModel.aggregate({ where: { name: 'Government Capture Probability' }, _max: { version: true } });
    if (validated) await this.prisma.rfpBidScoringModel.updateMany({ where: { name: 'Government Capture Probability', status: 'VALIDATED' }, data: { status: 'RETIRED' } });
    return this.prisma.rfpBidScoringModel.create({ data: { name: 'Government Capture Probability', version: (latest._max.version || 0) + 1, status: validated ? 'VALIDATED' : 'CANDIDATE', trainingSampleSize: samples.length, metrics: { brierScore, accuracy, thresholds: { minimumSamples: 30, maximumBrierScore: 0.25, minimumAccuracy: 0.6 } }, featureSchema: { source: 'persisted bid scores joined to verified WON/LOST outcomes' }, validatedBy: validated ? actorId(user) : null, validatedAt: validated ? new Date() : null } });
  }

  async detectAmendment(existing, incoming) {
    if (!existing?.samRetrievedAt) return null;
    const previousSnapshot = opportunitySnapshot(existing); const currentSnapshot = opportunitySnapshot(incoming);
    const changes = amendmentChanges(previousSnapshot, currentSnapshot);
    if (!changes.length) return null;
    const fingerprint = digest(currentSnapshot);
    const tenantId = currentTenantId() || 'default';
    const alreadyRecorded = await this.prisma.rfpAmendment.findFirst({ where: { tenantId, contractId: existing.noticeId, fingerprint } });
    const amendment = await this.prisma.rfpAmendment.upsert({ where: { tenantId_contractId_fingerprint: { tenantId, contractId: existing.noticeId, fingerprint } }, create: { tenantId, contractId: existing.noticeId, fingerprint, previousSnapshot, currentSnapshot, changes, affectedSections: affectedSections(changes) }, update: {} });
    if (!alreadyRecorded) await this.notifications.emitToTenant({ tenantId, eventType: 'AMENDMENT', subject: `SAM.gov amendment: ${incoming.title || existing.noticeId}`, payload: { noticeId: existing.noticeId, amendmentId: amendment.id, changes, affectedSections: amendment.affectedSections, message: 'An authoritative opportunity record changed. Review affected proposal sections.' } });
    return amendment;
  }
}

module.exports = { APPROVAL_GATES, CHECKLIST, RfpProductionService, affectedSections, amendmentChanges, opportunitySnapshot, requirementSentences };
