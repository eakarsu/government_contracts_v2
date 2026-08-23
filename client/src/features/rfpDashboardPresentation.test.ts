import { describe, expect, it } from 'vitest';
import {
  getNaicsVerificationNotice,
  getRfpGenerationSuccessNotice,
  hasExactNaicsMatch,
  isRfpWorkspaceCurrent,
  normalizeSixDigitNaicsCode,
  resolveOpportunitySelection,
  rfpGenerationPhaseReducer,
} from './rfpDashboardPresentation';

describe('RFP dashboard opportunity selection', () => {
  const opportunities = [
    { noticeId: 'newest-unrelated' },
    { noticeId: 'explicit-selection' },
  ];

  it('does not auto-select the newest opportunity when no opportunity was chosen', () => {
    expect(resolveOpportunitySelection('', opportunities)).toBe('');
  });

  it('retains an explicit valid selection and clears a stale selection', () => {
    expect(resolveOpportunitySelection('explicit-selection', opportunities)).toBe('explicit-selection');
    expect(resolveOpportunitySelection('not-loaded', opportunities)).toBe('');
  });
});

describe('RFP dashboard NAICS verification notice', () => {
  it('normalizes whitespace and display dashes only for valid six-digit NAICS codes', () => {
    expect(normalizeSixDigitNaicsCode(' 237-310 ')).toBe('237310');
    expect(normalizeSixDigitNaicsCode('CONSTRUCTION')).toBeNull();
    expect(normalizeSixDigitNaicsCode('23731')).toBeNull();
  });

  it('returns no notice for an exact verified NAICS match', () => {
    expect(hasExactNaicsMatch(['541512', ' 237-310 '], '237310')).toBe(true);
    expect(getNaicsVerificationNotice(['541512', ' 237-310 '], '237310')).toBeNull();
  });

  it('treats a profile with no saved NAICS codes as verification pending, not a blocker', () => {
    const notice = getNaicsVerificationNotice([], '237310');

    expect(notice?.title).toBe('NAICS verification pending');
    expect(notice?.message).toContain('No verified company NAICS codes are saved');
    expect(notice?.message).toContain('Bid analysis remains available');
  });

  it('treats a mismatched saved NAICS code as verification pending, not a blocker', () => {
    const notice = getNaicsVerificationNotice(['541512'], '237310');

    expect(notice?.title).toBe('NAICS verification pending');
    expect(notice?.message).toContain('do not include opportunity 237310');
    expect(notice?.message).toContain('add this code only if it is accurate');
    expect(notice?.message).toContain('Bid analysis remains available');
  });
});

describe('RFP generation presentation state', () => {
  it('stops reporting AI generation as soon as the server succeeds', () => {
    const generating = rfpGenerationPhaseReducer('idle', 'START');
    const loadingDraft = rfpGenerationPhaseReducer(generating, 'SERVER_SUCCEEDED');

    expect(generating).toBe('generating');
    expect(loadingDraft).toBe('loading_draft');
    expect(loadingDraft).not.toBe('generating');
    expect(rfpGenerationPhaseReducer(loadingDraft, 'RESET')).toBe('idle');
  });

  it('returns to idle when generation fails before a draft is available', () => {
    expect(rfpGenerationPhaseReducer('generating', 'RESET')).toBe('idle');
  });

  it('builds a durable success notice from the server result', () => {
    expect(getRfpGenerationSuccessNotice({
      message: 'Proposal application draft generated. Human review is required before submission.',
      rfpResponseId: 5,
      sectionsGenerated: 17,
    })).toBe('Proposal application draft generated. Human review is required before submission. Draft #5 is saved with 17 sections.');
  });

  it('allows governance controls only for the active draft workspace', () => {
    expect(isRfpWorkspaceCurrent(5, 5)).toBe(true);
    expect(isRfpWorkspaceCurrent(5, 4)).toBe(false);
    expect(isRfpWorkspaceCurrent(5, null)).toBe(false);
  });
});
