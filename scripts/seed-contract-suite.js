'use strict';

const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { DOMAINS } = require('../services/contractSuiteService');

const prisma = new PrismaClient();
const MINIMUM_PER_DOMAIN = 16;
const risks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statuses = ['OPEN', 'IN_REVIEW', 'BLOCKED', 'DECISION_REQUIRED'];
const priorities = ['MEDIUM', 'HIGH', 'CRITICAL', 'LOW'];

function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function dueDate(domainIndex, itemIndex) { return new Date(Date.UTC(2026, 8 + domainIndex, 3 + itemIndex)); }

function domainEvidence(domain, capability, index) {
  const common = {
    evidenceVersion: 1,
    sourceProject: domain.sourceProject,
    sourceReference: `${domain.slug.toUpperCase()}-${String(index).padStart(3, '0')}`,
    controls: ['Named accountable owner', 'Evidence-backed recommendation', 'Human decision required'],
  };
  if (domain.key === 'ACQUISITION') return { ...common, solicitationSection: ['L', 'M', 'C', 'H'][index % 4], readinessScore: 61 + index, complianceRows: 12 + index, reviewGate: ['Pink', 'Red', 'Gold', 'Final'][index % 4] };
  if (domain.key === 'NEGOTIATION') return { ...common, negotiationRound: 1 + (index % 5), clauseDeltaCount: 2 + index, marketPercentile: 45 + index, fallbackPosition: `Approved fallback ${capability[1]} position ${index}` };
  if (domain.key === 'VENDOR_RISK') return { ...common, vendorTier: 1 + (index % 4), subprocessors: index % 6, controlCoverage: 70 + index, frameworks: ['DPA', 'AI Act', 'DORA', 'NIS2', 'NIST 800-53'] };
  if (domain.key === 'SMART_CONTRACT') return { ...common, sourceDigest: digest(`${domain.key}-${index}`), language: index % 2 ? 'Solidity' : 'Vyper', network: ['Ethereum', 'Base', 'Arbitrum', 'Polygon'][index % 4], testCoverage: 72 + index, findingCount: 1 + (index % 7), executionBoundary: 'READ_ONLY_NO_WALLET' };
  return { ...common, athletePosition: ['Guard', 'Forward', 'Quarterback', 'Pitcher'][index % 4], valuationBasis: 'Verified comparables and governed assumptions', capYear: 2027 + (index % 3), performanceIndex: 78 + index, injuryAdjustment: Number((index % 5) * 0.03).toFixed(2) };
}

function seededAnalysis(item, domain, index) {
  return {
    summary: `${domain.label} review for ${item.title} identifies a controlled decision path supported by the attached evidence snapshot.`,
    riskAssessment: [
      { finding: `Validate the authoritative source and current assumptions for ${item.capability}.`, severity: item.riskLevel, evidence: `Evidence snapshot ${item.sourceRecordKey}` },
      { finding: 'Confirm accountable stakeholder concurrence before any binding action.', severity: 'MEDIUM', evidence: 'Human-control policy' },
    ],
    evidenceGaps: index % 4 === 0 ? ['Independent reviewer disposition', 'Current external-source timestamp'] : ['Independent reviewer disposition'],
    recommendations: [
      { action: item.recommendation, owner: item.ownerId, priority: item.priority },
      { action: 'Record the authorized human decision and retain supporting evidence.', owner: 'governance-reviewer', priority: 'HIGH' },
    ],
    humanDecision: 'An authorized domain owner must accept, revise, or reject this advisory analysis.',
  };
}

async function seed() {
  const matters = await prisma.contractMatter.findMany({ orderBy: { matterNumber: 'asc' }, take: MINIMUM_PER_DOMAIN });
  if (matters.length < MINIMUM_PER_DOMAIN) throw new Error(`Contract lifecycle must contain at least ${MINIMUM_PER_DOMAIN} matters before suite seeding`);

  for (const [domainIndex, domain] of DOMAINS.entries()) {
    for (let index = 1; index <= MINIMUM_PER_DOMAIN; index += 1) {
      const capability = domain.capabilities[(index - 1) % domain.capabilities.length];
      const matter = matters[(index - 1) % matters.length];
      const code = String(index).padStart(3, '0');
      const sourceRecordKey = `${domain.slug}-${code}`;
      const riskLevel = risks[(index + domainIndex) % risks.length];
      const record = await prisma.contractCapabilityWorkItem.upsert({
        where: { tenantId_sourceProject_sourceRecordKey: { tenantId: 'default', sourceProject: domain.sourceProject, sourceRecordKey } }, update: {},
        create: {
          matterId: matter.id, domain: domain.key, capability: capability[0], sourceProject: domain.sourceProject, sourceRecordKey,
          title: `${capability[1]} — ${matter.matterNumber}`, summary: `${capability[1]} workstream consolidated into the governed ${domain.label.toLowerCase()} workspace without duplicating lifecycle records.`,
          status: statuses[(index + domainIndex) % statuses.length], priority: priorities[(index + domainIndex) % priorities.length], riskLevel,
          ownerId: `${domain.slug}-owner-${(index % 4) + 1}`, counterparty: `${domain.label} Counterparty ${code}`, monetaryValue: 250000 + domainIndex * 500000 + index * 87500,
          probability: Number((0.46 + ((index + domainIndex) % 10) * 0.045).toFixed(3)), dueDate: dueDate(domainIndex, index),
          jurisdiction: domain.key === 'SPORTS' ? 'US-LEAGUE' : domain.key === 'SMART_CONTRACT' ? 'MULTICHAIN' : matter.jurisdiction,
          chainId: domain.key === 'SMART_CONTRACT' ? String([1, 8453, 42161, 137][index % 4]) : null,
          league: domain.key === 'SPORTS' ? ['NBA', 'NFL', 'MLB', 'NHL'][index % 4] : null,
          evidence: domainEvidence(domain, capability, index),
          recommendation: `Complete ${capability[1].toLowerCase()} evidence review and route the documented recommendation to an independent human decision owner.`,
        },
      });
      const inputDigest = digest({ seed: 'contract-suite-v1', workItemId: record.id });
      const analysisExists = await prisma.contractCapabilityAnalysis.findFirst({ where: { workItemId: record.id, inputDigest } });
      if (!analysisExists) await prisma.contractCapabilityAnalysis.create({ data: {
        workItemId: record.id, analysisType: `${domain.key}_SEEDED_ADVISORY`, inputDigest, output: seededAnalysis(record, domain, index),
        model: 'seeded-advisory-example', confidence: 0.7 + (index % 10) / 100, advisoryOnly: true, status: 'PENDING_HUMAN_REVIEW', createdBy: 'demo-contract-suite-seed',
      } });
    }
  }

  const counts = {};
  for (const domain of DOMAINS) {
    counts[domain.slug] = await prisma.contractCapabilityWorkItem.count({ where: { domain: domain.key } });
    if (counts[domain.slug] < MINIMUM_PER_DOMAIN) throw new Error(`${domain.label} contains ${counts[domain.slug]}; expected at least ${MINIMUM_PER_DOMAIN}`);
  }
  counts.analyses = await prisma.contractCapabilityAnalysis.count();
  if (counts.analyses < DOMAINS.length * MINIMUM_PER_DOMAIN) throw new Error(`Analyses contain ${counts.analyses}; expected at least ${DOMAINS.length * MINIMUM_PER_DOMAIN}`);
  console.log(counts);
}

seed().then(() => console.log('Contract capability suite seed completed without deleting existing records.')).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
