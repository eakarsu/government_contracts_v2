'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

const TENANT_SCOPED_MODELS = new Set([
  'SearchQuery',
  'Company',
  'ContractApplication',
  'AITemplate',
  'RfpTemplate',
  'CompanyProfile',
  'RfpResponse',
  'RfpVersion',
  'RfpRequirement',
  'RfpCollaborator',
  'RfpApproval',
  'RfpSubmissionChecklistItem',
  'RfpSubmission',
  'RfpOutcome',
  'RfpBidScoringModel',
  'RfpBidScore',
  'RfpAmendment',
  'RfpAuditEvent',
  'RfpComment',
  'GovernancePolicy',
  'RegulatorySource',
  'ComplianceEvaluation',
  'GovernanceAuditEvent',
  'ContractMatter',
  'ContractParty',
  'ContractDocumentVersion',
  'ContractClause',
  'ContractObligation',
  'ContractMilestone',
  'ContractAmendment',
  'ContractApproval',
  'ContractRenewal',
  'ContractRiskAssessment',
  'ContractTemplate',
  'ContractAiReview',
  'ContractIntegrationOutbox',
  'ContractLifecycleAuditEvent',
  'ContractCapabilityWorkItem',
  'ContractCapabilityAnalysis',
  'TenantMembership',
  'SecretRotationRecord',
  'DurableTask',
  'StoredDocument',
  'SavedSearch',
  'NotificationSubscription',
  'NotificationEvent',
  'CompanyEnrichment',
  'SubmissionPackageArtifact',
]);

const READ_ACTIONS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
const WRITE_WHERE_ACTIONS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

function normalizeTenantId(value) {
  const tenantId = String(value || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(tenantId)) throw new Error('Invalid tenant identifier');
  return tenantId;
}

function currentTenantId() {
  return storage.getStore()?.tenantId || null;
}

function runWithTenant(tenantId, callback) {
  return storage.run({ tenantId: normalizeTenantId(tenantId) }, callback);
}

function tenantWhere(where, tenantId) {
  return { ...(where || {}), tenantId };
}

function tenantData(data, tenantId) {
  return { ...(data || {}), tenantId };
}

function applyTenantScope(params, tenantId) {
  if (!tenantId || !TENANT_SCOPED_MODELS.has(params.model)) return params;
  params.args = params.args || {};

  if (READ_ACTIONS.has(params.action) || WRITE_WHERE_ACTIONS.has(params.action)) {
    params.args.where = tenantWhere(params.args.where, tenantId);
  }
  if (params.action === 'create') params.args.data = tenantData(params.args.data, tenantId);
  if (params.action === 'createMany') {
    params.args.data = Array.isArray(params.args.data)
      ? params.args.data.map(item => tenantData(item, tenantId))
      : tenantData(params.args.data, tenantId);
  }
  if (params.action === 'upsert') {
    params.args.where = tenantWhere(params.args.where, tenantId);
    params.args.create = tenantData(params.args.create, tenantId);
    params.args.update = tenantData(params.args.update, tenantId);
  }
  return params;
}

function installTenantMiddleware(prisma) {
  prisma.$use((params, next) => next(applyTenantScope(params, currentTenantId())));
  return prisma;
}

module.exports = {
  TENANT_SCOPED_MODELS,
  applyTenantScope,
  currentTenantId,
  installTenantMiddleware,
  normalizeTenantId,
  runWithTenant,
};
