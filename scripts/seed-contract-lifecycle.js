'use strict';

const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { ContractLifecycleService } = require('../services/contractLifecycleService');

const prisma = new PrismaClient();
const MINIMUM = 16;
const actor = { id: 'demo-lifecycle-seed' };
const agencies = ['Department of Defense', 'GSA', 'Department of Energy', 'Department of Veterans Affairs', 'NASA', 'Department of Homeland Security', 'Department of Transportation', 'Department of Health and Human Services'];
const contractTypes = ['Firm-Fixed-Price', 'Cost-Plus-Fixed-Fee', 'IDIQ', 'Time-and-Materials'];
const stages = ['INTAKE', 'DILIGENCE', 'NEGOTIATION', 'APPROVAL', 'EXECUTION', 'PERFORMANCE', 'RENEWAL', 'CLOSEOUT'];
const risks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function date(monthOffset, day = 15) { return new Date(Date.UTC(2026 + Math.floor(monthOffset / 12), monthOffset % 12, day)); }

async function seed() {
  const lifecycle = new ContractLifecycleService(prisma);
  for (let index = 1; index <= MINIMUM; index += 1) {
    const code = String(index).padStart(3, '0');
    const matter = await prisma.contractMatter.upsert({
      where: { tenantId_matterNumber: { tenantId: 'default', matterNumber: `GOV-CLM-2026-${code}` } }, update: {},
      create: {
        matterNumber: `GOV-CLM-2026-${code}`,
        title: `${['Secure Cloud Modernization', 'Mission Analytics Support', 'Critical Infrastructure Operations', 'Federal Health Data Platform'][index % 4]} — Workstream ${code}`,
        agency: agencies[(index - 1) % agencies.length], contractType: contractTypes[(index - 1) % contractTypes.length],
        jurisdiction: 'US-FEDERAL', stage: stages[(index - 1) % stages.length], status: index % 8 === 0 ? 'ON_HOLD' : 'ACTIVE',
        ownerId: `contract-manager-${(index % 4) + 1}`, createdBy: actor.id, retentionUntil: date(96 + index),
      },
    });

    let party = await prisma.contractParty.findFirst({ where: { matterId: matter.id, name: `Northstar Federal Solutions ${code}`, contractRole: 'PRIME_CONTRACTOR' } });
    if (!party) party = await prisma.contractParty.create({ data: { matterId: matter.id, name: `Northstar Federal Solutions ${code}`, partyType: 'CONTRACTOR', contractRole: 'PRIME_CONTRACTOR', uei: `UEI-DEMO-${code}`, cageCode: `C${code.slice(-2)}X`, riskRating: risks[index % 4], sanctionsStatus: 'CLEAR' } });

    const document = await prisma.contractDocumentVersion.upsert({
      where: { matterId_title_version: { matterId: matter.id, title: 'Executed Base Contract', version: 1 } }, update: {},
      create: { matterId: matter.id, documentType: 'BASE_CONTRACT', title: 'Executed Base Contract', version: 1, sourceUrl: `https://sam.gov/opp/demo-${code}`, contentHash: hash(`executed-contract-${code}`), privilege: 'BUSINESS_CONFIDENTIAL', effectiveDate: date(index - 1, 1), uploadedBy: actor.id },
    });

    const clause = await prisma.contractClause.upsert({
      where: { matterId_clauseKey: { matterId: matter.id, clauseKey: `FAR-52.2${String(10 + index).padStart(2, '0')}` } }, update: {},
      create: { matterId: matter.id, documentVersionId: document.id, clauseKey: `FAR-52.2${String(10 + index).padStart(2, '0')}`, title: `${['Audit and Records', 'Data Rights', 'Cyber Incident Reporting', 'Changes'][index % 4]} Clause`, category: ['COMPLIANCE', 'INTELLECTUAL_PROPERTY', 'CYBERSECURITY', 'COMMERCIAL'][index % 4], text: 'The contractor shall maintain cited evidence and perform the requirement within the stated contractual period.', citation: `Section ${index + 2}.${index}`, riskLevel: risks[index % 4], status: index % 3 === 0 ? 'REVIEW_REQUIRED' : 'ACCEPTED', fallbackText: 'Use the approved agency alternate with a documented deviation and authorized legal approval.', aiConfidence: 0.82 + (index % 9) / 100, reviewedBy: index % 3 === 0 ? null : 'legal-reviewer-1' },
    });

    await prisma.contractObligation.upsert({
      where: { matterId_reference: { matterId: matter.id, reference: `OBL-${code}` } }, update: {},
      create: { matterId: matter.id, clauseId: clause.id, reference: `OBL-${code}`, description: `${['Submit monthly performance report', 'Maintain CMMC evidence package', 'Deliver invoice reconciliation', 'Validate subcontractor flow-downs'][index % 4]}.`, ownerId: `program-owner-${(index % 5) + 1}`, dueDate: date(index + 1, 20), recurrence: index % 2 ? 'MONTHLY' : 'QUARTERLY', status: ['OPEN', 'IN_PROGRESS', 'SATISFIED', 'AT_RISK'][index % 4], evidenceUrl: `https://evidence.example.gov/matters/${code}/obligation`, escalationLevel: index % 4 },
    });

    await prisma.contractMilestone.upsert({
      where: { matterId_reference: { matterId: matter.id, reference: `MS-${code}` } }, update: {},
      create: { matterId: matter.id, reference: `MS-${code}`, name: `${['Quarterly program review', 'Security authorization gate', 'Option-year readiness review', 'Final acceptance review'][index % 4]}`, dueDate: date(index + 2, 10), status: ['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'AT_RISK'][index % 4], ownerId: `program-owner-${(index % 5) + 1}`, evidenceUrl: `https://evidence.example.gov/matters/${code}/milestone` },
    });

    await prisma.contractAmendment.upsert({
      where: { matterId_amendmentNumber: { matterId: matter.id, amendmentNumber: `MOD-${code}` } }, update: {},
      create: { matterId: matter.id, documentVersionId: document.id, amendmentNumber: `MOD-${code}`, title: `${['Funding realignment', 'Period-of-performance extension', 'Security requirement update', 'Scope clarification'][index % 4]}`, description: 'Controlled modification evaluated against the base contract, affected clauses, obligations, funding, and delivery schedule.', effectiveDate: date(index, 1), priceDelta: (index % 5 - 2) * 125000, impactSummary: 'Review funding, deliverable dates, clause flow-downs, and revenue/cost assumptions before execution.', riskLevel: risks[index % 4], status: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'EXECUTED'][index % 4], createdBy: actor.id },
    });

    const approvalExists = await prisma.contractApproval.findFirst({ where: { matterId: matter.id, resourceType: 'MATTER', resourceId: matter.id, step: 'LEGAL' } });
    if (!approvalExists) await prisma.contractApproval.create({ data: { matterId: matter.id, resourceType: 'MATTER', resourceId: matter.id, step: 'LEGAL', decision: index % 6 === 0 ? 'REJECTED' : 'APPROVED', rationale: 'Independent legal review checked authority, citations, deviations, data rights, and required flow-down evidence.', actorId: 'legal-reviewer-demo' } });

    await prisma.contractRenewal.upsert({
      where: { matterId_optionPeriod: { matterId: matter.id, optionPeriod: `OPTION-${(index % 4) + 1}` } }, update: {},
      create: { matterId: matter.id, optionPeriod: `OPTION-${(index % 4) + 1}`, noticeDeadline: date(index + 3, 1), exerciseDeadline: date(index + 4, 1), estimatedValue: 800000 + index * 175000, status: ['MONITORING', 'RECOMMENDED', 'DECISION_REQUIRED', 'EXERCISED'][index % 4], recommendation: `${index % 4 === 2 ? 'Resolve performance and funding exceptions before exercise.' : 'Proceed subject to contracting officer determination and current performance evidence.'}`, ownerId: `renewal-owner-${(index % 3) + 1}` },
    });

    const assessmentKey = `RISK-2026-${code}`;
    await prisma.contractRiskAssessment.upsert({
      where: { matterId_assessmentKey: { matterId: matter.id, assessmentKey } }, update: {},
      create: { matterId: matter.id, assessmentKey, legalScore: 20 + (index * 7) % 75, financialScore: 18 + (index * 9) % 77, operationalScore: 22 + (index * 11) % 73, cybersecurityScore: 25 + (index * 13) % 70, complianceScore: 15 + (index * 5) % 80, overallRating: risks[index % 4], findings: [{ category: 'Evidence', finding: 'Confirm the current authoritative clause version and accountable owner.', priority: risks[index % 4] }, { category: 'Schedule', finding: 'Reconcile milestone and option notice dates with the signed modification.', priority: 'MEDIUM' }], assessedBy: 'risk-reviewer-demo', sourceDigest: hash(`risk-evidence-${code}`) },
    });

    const aiExists = await prisma.contractAiReview.findFirst({ where: { matterId: matter.id, promptDigest: hash(`demo-ai-review-${code}`) } });
    if (!aiExists) await prisma.contractAiReview.create({ data: { matterId: matter.id, reviewType: 'LIFECYCLE_READINESS', promptDigest: hash(`demo-ai-review-${code}`), output: `Executive assessment\n\nMatter ${matter.matterNumber} requires human validation of the cited clause version, obligation evidence, amendment impact, and option deadline.\n\nPriority actions\n1. Confirm contracting authority and effective FAR/DFARS source.\n2. Resolve open evidence and ownership gaps.\n3. Obtain independent legal, business, and compliance approval before commitment.`, model: 'seeded-advisory-example', citations: [{ clauseKey: clause.clauseKey, citation: clause.citation }], confidence: 0.76, advisoryOnly: true, status: 'PENDING_HUMAN_REVIEW', createdBy: actor.id } });

    await prisma.contractIntegrationOutbox.upsert({
      where: { idempotencyKey: `demo-outbox-${code}` }, update: {},
      create: { matterId: matter.id, provider: ['SAM_GOV', 'DOCUSIGN', 'CRM', 'ERP'][index % 4], operation: ['SYNC_NOTICE', 'REQUEST_SIGNATURE', 'SYNC_ACCOUNT', 'PUSH_COMMITMENT'][index % 4], idempotencyKey: `demo-outbox-${code}`, payload: { matterNumber: matter.matterNumber, evidenceDigest: hash(`outbox-${code}`) }, status: ['PENDING', 'DELIVERED', 'RETRY', 'PENDING'][index % 4], attempts: index % 3, receipt: index % 4 === 1 ? { externalId: `receipt-${code}`, receivedAt: date(index).toISOString() } : null, lastErrorCode: index % 4 === 2 ? 'PROVIDER_TIMEOUT' : null },
    });

    const auditCount = await prisma.contractLifecycleAuditEvent.count({ where: { aggregateId: matter.id } });
    if (!auditCount) await lifecycle.audit(matter.id, 'DEMO_MATTER_IMPORTED', actor, { matterNumber: matter.matterNumber, source: 'AIContractLifecycleManager capability consolidation' });
  }

  for (let index = 1; index <= MINIMUM; index += 1) {
    const code = String(index).padStart(3, '0');
    await prisma.contractTemplate.upsert({
      where: { tenantId_templateKey_version: { tenantId: 'default', templateKey: `GOV-TEMPLATE-${code}`, version: 1 } }, update: {},
      create: { templateKey: `GOV-TEMPLATE-${code}`, version: 1, name: `${['Services Task Order', 'Data Protection Addendum', 'Subcontractor Flow-down', 'Option Exercise Memorandum'][index % 4]} ${code}`, agency: agencies[(index - 1) % agencies.length], contractType: contractTypes[(index - 1) % contractTypes.length], content: 'Approved government-contract template. Populate agency, authority, statement of work, deliverables, clauses, funding, and signatures from verified source records.', playbookRules: [{ rule: 'CITATIONS_REQUIRED', severity: 'BLOCKING' }, { rule: 'HUMAN_APPROVAL_REQUIRED', severity: 'BLOCKING' }], status: index % 4 === 0 ? 'DRAFT' : 'APPROVED', approvedBy: index % 4 === 0 ? null : 'legal-reviewer-demo', effectiveFrom: date(index - 1, 1) },
    });
  }

  const checks = {
    matters: await prisma.contractMatter.count(), parties: await prisma.contractParty.count(), documents: await prisma.contractDocumentVersion.count(),
    clauses: await prisma.contractClause.count(), obligations: await prisma.contractObligation.count(), milestones: await prisma.contractMilestone.count(),
    amendments: await prisma.contractAmendment.count(), approvals: await prisma.contractApproval.count(), renewals: await prisma.contractRenewal.count(),
    risks: await prisma.contractRiskAssessment.count(), templates: await prisma.contractTemplate.count(), aiReviews: await prisma.contractAiReview.count(),
    integrations: await prisma.contractIntegrationOutbox.count(), auditEvents: await prisma.contractLifecycleAuditEvent.count(),
  };
  for (const [name, total] of Object.entries(checks)) if (total < MINIMUM) throw new Error(`${name} contains ${total}; expected at least ${MINIMUM}`);
  console.log(checks);
}

seed().then(() => console.log('Contract lifecycle seed completed without deleting existing records.')).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
