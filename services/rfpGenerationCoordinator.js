'use strict';

const crypto = require('node:crypto');

const DEFAULT_REUSE_WINDOW_MS = 30 * 60 * 1000;
const FINGERPRINT_VERSION = 1;

function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeRevision(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? normalizeText(value) || null : date.toISOString();
}

function normalizeGenerationInput(input = {}) {
  return {
    tenantId: normalizeText(input.tenantId),
    contract: {
      id: normalizeText(input.contractId),
      revision: normalizeRevision(input.contractRevision),
    },
    template: {
      id: input.templateId == null ? null : Number(input.templateId),
      revision: normalizeRevision(input.templateRevision),
    },
    companyProfile: {
      id: input.companyProfileId == null ? null : Number(input.companyProfileId),
      revision: normalizeRevision(input.companyProfileRevision),
    },
    customInstructions: normalizeText(input.customInstructions),
    focusAreas: Array.isArray(input.focusAreas)
      ? input.focusAreas.map(normalizeText).filter(Boolean)
      : [],
  };
}

function generationFingerprint(input) {
  const canonical = {
    version: FINGERPRINT_VERSION,
    ...normalizeGenerationInput(input),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function responseMetadata(response) {
  try {
    const data = typeof response?.responseData === 'string'
      ? JSON.parse(response.responseData)
      : response?.responseData;
    return data?.metadata && typeof data.metadata === 'object' ? data.metadata : {};
  } catch {
    return {};
  }
}

function legacyMetadataMatches(metadata, normalized) {
  if (!metadata || metadata.generationFingerprint) return false;
  const sourceContractNoticeId = normalizeText(metadata.sourceContractNoticeId);
  const sourceContractUpdatedAt = normalizeRevision(metadata.sourceContractUpdatedAt);
  const customInstructions = normalizeText(metadata.customInstructions);
  const focusAreas = Array.isArray(metadata.focusAreas)
    ? metadata.focusAreas.map(normalizeText).filter(Boolean)
    : [];
  return sourceContractNoticeId === normalized.contract.id
    && sourceContractUpdatedAt === normalized.contract.revision
    && customInstructions === normalized.customInstructions
    && JSON.stringify(focusAreas) === JSON.stringify(normalized.focusAreas);
}

class RfpGenerationCoordinator {
  constructor({ prisma, generate, reuseWindowMs = DEFAULT_REUSE_WINDOW_MS, now = () => Date.now() }) {
    if (!prisma?.rfpResponse || typeof generate !== 'function') {
      throw new Error('RfpGenerationCoordinator requires prisma.rfpResponse and a generate function');
    }
    this.prisma = prisma;
    this.generate = generate;
    this.reuseWindowMs = reuseWindowMs;
    this.now = now;
    this.inFlight = new Map();
  }

  async findRecentlyCompleted(input, fingerprint) {
    const normalized = normalizeGenerationInput(input);
    const candidates = await this.prisma.rfpResponse.findMany({
      where: {
        tenantId: normalized.tenantId,
        contractId: normalized.contract.id,
        templateId: normalized.template.id,
        companyProfileId: normalized.companyProfile.id,
        status: 'draft',
        createdAt: { gte: new Date(this.now() - this.reuseWindowMs) },
        auditEvents: { some: { action: 'REQUIREMENTS_SYNCHRONIZED' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    for (const response of candidates) {
      const metadata = responseMetadata(response);
      if (metadata.generationFingerprint === fingerprint) {
        return { response, reuseReason: 'recently_completed' };
      }
      if (legacyMetadataMatches(metadata, normalized)) {
        return { response, reuseReason: 'recently_completed_legacy' };
      }
    }
    return null;
  }

  async run(input, { forceRegenerate = false } = {}) {
    const normalized = normalizeGenerationInput(input);
    if (!normalized.tenantId || !normalized.contract.id) {
      throw new Error('Tenant and contract identifiers are required for coordinated RFP generation');
    }
    const fingerprint = generationFingerprint(input);

    if (forceRegenerate) {
      const response = await this.generate({ ...input, generationFingerprint: fingerprint });
      return { response, fingerprint, reused: false, reuseReason: null };
    }

    const active = this.inFlight.get(fingerprint);
    if (active) {
      const result = await active;
      return { response: result.response, fingerprint, reused: true, reuseReason: 'in_flight' };
    }

    const operation = (async () => {
      const recent = await this.findRecentlyCompleted(input, fingerprint);
      if (recent) return recent;
      const response = await this.generate({ ...input, generationFingerprint: fingerprint });
      return { response, reuseReason: null };
    })();
    this.inFlight.set(fingerprint, operation);

    try {
      const result = await operation;
      return {
        response: result.response,
        fingerprint,
        reused: Boolean(result.reuseReason),
        reuseReason: result.reuseReason,
      };
    } finally {
      if (this.inFlight.get(fingerprint) === operation) this.inFlight.delete(fingerprint);
    }
  }
}

module.exports = {
  DEFAULT_REUSE_WINDOW_MS,
  FINGERPRINT_VERSION,
  RfpGenerationCoordinator,
  generationFingerprint,
  legacyMetadataMatches,
  normalizeGenerationInput,
  responseMetadata,
};
