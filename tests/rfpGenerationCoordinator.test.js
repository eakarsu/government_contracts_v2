'use strict';

const {
  RfpGenerationCoordinator,
  generationFingerprint,
  legacyMetadataMatches,
  normalizeGenerationInput,
} = require('../services/rfpGenerationCoordinator');

function input(overrides = {}) {
  return {
    tenantId: 'tenant-a',
    contractId: 'notice-123',
    contractRevision: '2026-08-23T10:00:00.000Z',
    templateId: 11,
    templateRevision: '2026-08-23T10:01:00.000Z',
    companyProfileId: 22,
    companyProfileRevision: '2026-08-23T10:02:00.000Z',
    customInstructions: 'Use verified evidence.',
    focusAreas: ['Security', 'Delivery'],
    ...overrides,
  };
}

function coordinator({ candidates = [], generate, now } = {}) {
  const findMany = jest.fn().mockResolvedValue(candidates);
  return {
    findMany,
    instance: new RfpGenerationCoordinator({
      prisma: { rfpResponse: { findMany } },
      generate: generate || jest.fn().mockResolvedValue({ id: 99, responseData: '{}' }),
      now: now || (() => Date.parse('2026-08-23T11:00:00.000Z')),
    }),
  };
}

describe('RFP generation coordination', () => {
  test('fingerprints every generation choice and isolates tenants', () => {
    const baseline = generationFingerprint(input());

    for (const changed of [
      { tenantId: 'tenant-b' },
      { contractId: 'notice-456' },
      { contractRevision: '2026-08-23T10:00:01.000Z' },
      { templateId: 12 },
      { templateRevision: '2026-08-23T10:01:01.000Z' },
      { companyProfileId: 23 },
      { companyProfileRevision: '2026-08-23T10:02:01.000Z' },
      { customInstructions: 'Use a different instruction.' },
      { focusAreas: ['Delivery', 'Security'] },
    ]) {
      expect(generationFingerprint(input(changed))).not.toBe(baseline);
    }
  });

  test('coalesces identical in-flight requests into one generation', async () => {
    let release;
    const generate = jest.fn().mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const { instance, findMany } = coordinator({ generate });

    const first = instance.run(input());
    await Promise.resolve();
    const second = instance.run(input());
    await Promise.resolve();
    release({ id: 44, responseData: '{}' });

    await expect(first).resolves.toMatchObject({ response: { id: 44 }, reused: false, reuseReason: null });
    await expect(second).resolves.toMatchObject({ response: { id: 44 }, reused: true, reuseReason: 'in_flight' });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  test('reuses a recently completed matching draft within the same tenant', async () => {
    const request = input();
    const fingerprint = generationFingerprint(request);
    const existing = {
      id: 55,
      responseData: JSON.stringify({ metadata: { generationFingerprint: fingerprint } }),
    };
    const generate = jest.fn();
    const { instance, findMany } = coordinator({ candidates: [existing], generate });

    await expect(instance.run(request)).resolves.toMatchObject({
      response: { id: 55 },
      reused: true,
      reuseReason: 'recently_completed',
    });
    expect(generate).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        contractId: 'notice-123',
        templateId: 11,
        companyProfileId: 22,
        auditEvents: { some: { action: 'REQUIREMENTS_SYNCHRONIZED' } },
      }),
    }));
  });

  test('conservatively reuses a completed legacy draft with matching generation metadata', async () => {
    const request = input();
    const existing = {
      id: 56,
      responseData: JSON.stringify({
        metadata: {
          sourceContractNoticeId: ' notice-123 ',
          sourceContractUpdatedAt: '2026-08-23T10:00:00.000Z',
          customInstructions: ' Use verified evidence. ',
          focusAreas: [' Security ', 'Delivery'],
        },
      }),
    };
    const generate = jest.fn();
    const { instance, findMany } = coordinator({ candidates: [existing], generate });

    await expect(instance.run(request)).resolves.toMatchObject({
      response: { id: 56 },
      reused: true,
      reuseReason: 'recently_completed_legacy',
    });
    expect(generate).not.toHaveBeenCalled();
    expect(findMany.mock.calls[0][0].where.tenantId).toBe('tenant-a');
  });

  test('legacy reuse requires every stored input to match and no modern fingerprint', () => {
    const normalized = normalizeGenerationInput(input());
    const baseline = {
      sourceContractNoticeId: 'notice-123',
      sourceContractUpdatedAt: '2026-08-23T10:00:00.000Z',
      customInstructions: 'Use verified evidence.',
      focusAreas: ['Security', 'Delivery'],
    };

    expect(legacyMetadataMatches(baseline, normalized)).toBe(true);
    for (const changed of [
      { sourceContractNoticeId: 'notice-456' },
      { sourceContractUpdatedAt: '2026-08-23T10:00:01.000Z' },
      { customInstructions: 'Different instructions.' },
      { focusAreas: ['Delivery', 'Security'] },
      { generationFingerprint: 'modern-fingerprint' },
    ]) {
      expect(legacyMetadataMatches({ ...baseline, ...changed }, normalized)).toBe(false);
    }
    expect(legacyMetadataMatches({}, normalized)).toBe(false);
  });

  test('does not reuse legacy, corrupt, or cross-tenant fingerprints', async () => {
    const crossTenantFingerprint = generationFingerprint(input({ tenantId: 'tenant-b' }));
    const candidates = [
      { id: 1, responseData: '{}' },
      { id: 2, responseData: '{invalid' },
      { id: 3, responseData: JSON.stringify({ metadata: { generationFingerprint: crossTenantFingerprint } }) },
    ];
    const generate = jest.fn().mockResolvedValue({ id: 66, responseData: '{}' });
    const { instance } = coordinator({ candidates, generate });

    await expect(instance.run(input())).resolves.toMatchObject({ response: { id: 66 }, reused: false });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('forceRegenerate bypasses both recent reuse and in-flight coalescing', async () => {
    const request = input();
    const existing = {
      id: 77,
      responseData: JSON.stringify({ metadata: { generationFingerprint: generationFingerprint(request) } }),
    };
    const generate = jest.fn().mockResolvedValue({ id: 88, responseData: '{}' });
    const { instance, findMany } = coordinator({ candidates: [existing], generate });

    await expect(instance.run(request, { forceRegenerate: true })).resolves.toMatchObject({
      response: { id: 88 },
      reused: false,
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
