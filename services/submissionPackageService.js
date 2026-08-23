'use strict';

const config = require('../config/env');

const DEFAULT_ARTIFACTS = [
  ['PROPOSAL_DOCUMENT', 'Technical and management proposal', true, false],
  ['COST_PROPOSAL', 'Cost/price proposal', true, false],
  ['REPRESENTATIONS_CERTIFICATIONS', 'Representations and certifications', true, false],
  ['SIGNATURE_PAGE', 'Authorized signature page', true, true],
  ['SUPPORTING_ATTACHMENTS', 'Supporting attachments', false, false],
];

function json(value, fallback) { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } }
function validFileName(name) { return /^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,199}\.[a-zA-Z0-9]{2,8}$/.test(String(name || '')); }

class SubmissionPackageService {
  constructor(prisma, configuration = config) { this.prisma = prisma; this.config = configuration; }

  async initialize(rfpResponseId) {
    await this.prisma.submissionPackageArtifact.createMany({
      data: DEFAULT_ARTIFACTS.map(([artifactType, displayName, required, signatureRequired]) => ({ rfpResponseId, artifactType, displayName, required, signatureRequired, signatureStatus: signatureRequired ? 'PENDING' : 'NOT_REQUIRED' })),
      skipDuplicates: true,
    });
    return this.list(rfpResponseId);
  }

  list(rfpResponseId) { return this.prisma.submissionPackageArtifact.findMany({ where: { rfpResponseId }, orderBy: { createdAt: 'asc' } }); }

  async update(rfpResponseId, artifactType, input, user) {
    await this.initialize(rfpResponseId);
    const artifact = await this.prisma.submissionPackageArtifact.findFirst({ where: { rfpResponseId, artifactType } });
    if (!artifact) throw Object.assign(new Error('Package artifact not found'), { statusCode: 404 });
    const signatureStatus = input.signatureStatus ? String(input.signatureStatus).toUpperCase() : artifact.signatureStatus;
    if (!['NOT_REQUIRED', 'PENDING', 'SIGNED'].includes(signatureStatus)) throw Object.assign(new Error('Invalid signature status'), { statusCode: 400 });
    if (input.storedDocumentId) {
      const stored = await this.prisma.storedDocument.findUnique({ where: { id: String(input.storedDocumentId) } });
      const allowedStatuses = this.config.malwareScanMode === 'disabled' ? ['CLEAN', 'SKIPPED'] : ['CLEAN'];
      if (!stored || !allowedStatuses.includes(stored.malwareStatus)) throw Object.assign(new Error('Only a tenant-owned, malware-clean stored document can be added to a submission package'), { statusCode: 409 });
    }
    return this.prisma.submissionPackageArtifact.update({ where: { id: artifact.id }, data: {
      fileName: input.fileName === undefined ? artifact.fileName : String(input.fileName || '').trim() || null,
      storedDocumentId: input.storedDocumentId === undefined ? artifact.storedDocumentId : input.storedDocumentId || null,
      signatureStatus,
      portalInstructions: input.portalInstructions === undefined ? artifact.portalInstructions : input.portalInstructions,
      completedBy: input.completed ? String(user.email || user.id) : null,
      completedAt: input.completed ? new Date() : null,
    } });
  }

  async validate(rfpResponseId) {
    const response = await this.prisma.rfpResponse.findUnique({ where: { id: rfpResponseId }, include: { requirements: true } });
    if (!response) throw Object.assign(new Error('RFP response not found'), { statusCode: 404 });
    const artifacts = await this.initialize(rfpResponseId);
    const data = json(response.responseData, {});
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const global = [];
    if (!sections.length) global.push({ code: 'NO_PROPOSAL_SECTIONS', severity: 'ERROR', message: 'No proposal sections are available.' });
    if (sections.some(section => !String(section.content || '').trim() || /Generation failed/i.test(section.content || ''))) global.push({ code: 'INCOMPLETE_SECTIONS', severity: 'ERROR', message: 'One or more proposal sections are incomplete.' });
    if (response.requirements.some(item => item.reviewStatus !== 'VERIFIED' || !['COVERED', 'NOT_APPLICABLE'].includes(item.coverageStatus))) global.push({ code: 'UNVERIFIED_REQUIREMENTS', severity: 'ERROR', message: 'Solicitation requirements remain unverified or uncovered.' });

    const validated = [];
    for (const artifact of artifacts) {
      const findings = [];
      const proposalVirtual = artifact.artifactType === 'PROPOSAL_DOCUMENT' && sections.length > 0;
      if (artifact.required && !artifact.storedDocumentId && !proposalVirtual) findings.push({ code: 'REQUIRED_FILE_MISSING', severity: 'ERROR', message: `${artifact.displayName} is missing.` });
      if (artifact.fileName && !validFileName(artifact.fileName)) findings.push({ code: 'INVALID_FILE_NAME', severity: 'ERROR', message: 'Filename must use a safe name and recognized extension.' });
      if (artifact.signatureRequired && artifact.signatureStatus !== 'SIGNED') findings.push({ code: 'SIGNATURE_MISSING', severity: 'ERROR', message: 'An authorized signature is required.' });
      const validationStatus = findings.some(item => item.severity === 'ERROR') ? 'INVALID' : 'VALID';
      validated.push(await this.prisma.submissionPackageArtifact.update({ where: { id: artifact.id }, data: { validationStatus, validationFindings: findings } }));
    }
    const findings = [...global, ...validated.flatMap(item => item.validationFindings)];
    return { valid: !findings.some(item => item.severity === 'ERROR'), enforcement: this.config.submissionPackageEnforcement, findings, artifacts: validated, humanControlledSubmission: true };
  }
}

module.exports = { DEFAULT_ARTIFACTS, SubmissionPackageService, validFileName };
