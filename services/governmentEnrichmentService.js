'use strict';

const crypto = require('node:crypto');
const config = require('../config/env');
const { prisma } = require('../config/database');

function digest(payload) { return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'); }
async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Government source returned ${response.status}: ${body.message || body.error || 'request failed'}`);
  return body;
}

class GovernmentEnrichmentService {
  constructor(options = {}) { this.prisma = options.prisma || prisma; this.config = options.config || config; }

  async samEntity(uei) {
    if (!this.config.samGovApiKey) throw new Error('SAM_GOV_API_KEY is required');
    const normalized = String(uei || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{12}$/.test(normalized)) throw new Error('A valid 12-character UEI is required');
    const url = new URL('https://api.sam.gov/entity-information/v4/entities');
    url.searchParams.set('ueiSAM', normalized);
    const payload = await jsonRequest(url, { headers: { 'x-api-key': this.config.samGovApiKey } });
    return { source: 'SAM_ENTITY_PUBLIC', externalId: normalized, evidenceUrl: `https://sam.gov/entity/${normalized}/coreData`, payload };
  }

  async usaSpending(identifier) {
    const value = String(identifier || '').trim();
    if (!value) throw new Error('A recipient name or UEI is required');
    const payload = await jsonRequest('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filters: { recipient_search_text: [value], award_type_codes: ['A', 'B', 'C', 'D'] },
        fields: ['Award ID', 'Recipient Name', 'Recipient UEI', 'Start Date', 'End Date', 'Award Amount', 'Awarding Agency', 'Description', 'NAICS', 'PSC'],
        page: 1, limit: 100, order: 'desc', sort: 'End Date', subawards: false,
      }),
    });
    return { source: 'USASPENDING_FPDS', externalId: value, evidenceUrl: 'https://www.usaspending.gov/search', payload };
  }

  async capture(companyProfileId, source, identifier, user) {
    const profile = await this.prisma.companyProfile.findUnique({ where: { id: Number(companyProfileId) } });
    if (!profile) throw new Error('Company profile not found');
    let evidence;
    if (source === 'SAM_ENTITY_PUBLIC') evidence = await this.samEntity(identifier);
    else if (source === 'USASPENDING_FPDS') evidence = await this.usaSpending(identifier);
    else if (source === 'CPARS') throw new Error('CPARS enrichment requires an authorized agency integration and is not available through public credentials');
    else if (source === 'SBA') throw new Error('Use a reviewed SBA dataset export; no unsupported or private SBA endpoint will be queried automatically');
    else throw new Error('Unsupported enrichment source');
    const contentHash = digest(evidence.payload);
    const existing = await this.prisma.companyEnrichment.findFirst({ where: { companyProfileId: profile.id, source: evidence.source, externalId: evidence.externalId, contentHash } });
    if (existing) return existing;
    return this.prisma.companyEnrichment.create({ data: { companyProfileId: profile.id, ...evidence, retrievedAt: new Date(), contentHash, status: 'SOURCE_CAPTURED_PENDING_REVIEW', createdBy: String(user.email || user.id) } });
  }
}

module.exports = { GovernmentEnrichmentService };
