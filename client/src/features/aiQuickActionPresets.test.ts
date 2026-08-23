import { describe, expect, it } from 'vitest';
import { AI_REQUEST_PRESETS, applyOpportunityContext, hasCompleteAiRequest, toUserContext } from './aiQuickActionPresets';

describe('AI quick-action presets', () => {
  it('provides multiple presets and every preset fills every request field', () => {
    expect(AI_REQUEST_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const preset of AI_REQUEST_PRESETS) {
      expect(hasCompleteAiRequest(preset.values), preset.name).toBe(true);
      expect(Object.keys(preset.values)).toHaveLength(23);
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
    expect(context.opportunityContext).toEqual(expect.objectContaining({
      noticeId: expect.any(String),
      title: expect.any(String),
      agency: expect.any(String),
      naicsCodes: expect.any(Array),
      estimatedValue: expect.any(Number),
    }));
  });

  it('combines the selected analysis context with real opportunity metadata', () => {
    const defaults = AI_REQUEST_PRESETS[0].values;
    const result = applyOpportunityContext(defaults, defaults, {
      id: 1, noticeId: 'notice-1', title: 'Cloud Data Platform Engineering', agency: 'DEPT OF DEFENSE.DEPT OF THE ARMY',
      naicsCode: '541512', classificationCode: 'DA10', createdAt: '2026-08-01', updatedAt: '2026-08-01',
      description: 'Modernize the agency data platform.', postedDate: '2026-08-01', setAsideCode: 'SBA',
      samData: { naicsCodes: ['541512', '541519'], placeOfPerformance: { city: { name: 'Arlington' }, state: { code: 'VA' }, country: { code: 'USA' } }, type: 'Solicitation', award: { amount: '750000' }, responseDeadLine: '2026-09-15' },
    });
    expect(result).toMatchObject({ minContractValue: 750000, preferredNaicsCodes: '541512, 541519', preferredAgencies: 'DEPT OF DEFENSE, DEPT OF THE ARMY', preferredStates: 'VA' });
    expect(result).toMatchObject({
      opportunityNoticeId: 'notice-1',
      opportunityTitle: 'Cloud Data Platform Engineering',
      opportunityAgency: 'DEPT OF DEFENSE.DEPT OF THE ARMY',
      opportunityNaicsCodes: '541512, 541519',
      opportunityClassification: 'DA10',
      opportunitySetAside: 'SBA',
      opportunityLocation: 'Arlington, VA, USA',
      opportunityPostedDate: '2026-08-01',
      opportunityResponseDeadline: '2026-09-15',
      opportunityValue: 750000,
      opportunityDescription: 'Modernize the agency data platform.',
    });
    expect(result.keywords).toContain('Cloud');
    expect(result.certifications).toBe(defaults.certifications);
    expect(result.pastWins).toBe(defaults.pastWins);
  });
});
