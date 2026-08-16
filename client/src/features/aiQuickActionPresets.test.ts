import { describe, expect, it } from 'vitest';
import { AI_REQUEST_PRESETS, hasCompleteAiRequest, toUserContext } from './aiQuickActionPresets';

describe('AI quick-action presets', () => {
  it('provides multiple presets and every preset fills every request field', () => {
    expect(AI_REQUEST_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const preset of AI_REQUEST_PRESETS) {
      expect(hasCompleteAiRequest(preset.values), preset.name).toBe(true);
      expect(Object.keys(preset.values)).toHaveLength(12);
    }
  });

  it('converts every form field to structured AI context', () => {
    const context = toUserContext(AI_REQUEST_PRESETS[0].values);
    expect(context.companyProfile).toEqual(expect.objectContaining({
      annualRevenue: expect.any(Number),
      certifications: expect.any(Array),
      experienceInNaics: expect.any(Array),
      agencyRelationships: expect.any(Array),
      pastWins: expect.any(Array),
      hasBonding: expect.any(Boolean),
    }));
    expect(context.preferences).toEqual(expect.objectContaining({
      minContractValue: expect.any(Number),
      preferredNaicsCodes: expect.any(Array),
      preferredAgencies: expect.any(Array),
      preferredStates: expect.any(Array),
      keywords: expect.any(Array),
      maxAgeDays: expect.any(Number),
    }));
  });
});
