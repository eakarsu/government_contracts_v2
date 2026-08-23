import type { Contract, RFPGenerationResponse } from '../types';

export type RfpGenerationPhase = 'idle' | 'generating' | 'loading_draft';
export type RfpGenerationEvent = 'START' | 'SERVER_SUCCEEDED' | 'RESET';

export function rfpGenerationPhaseReducer(
  phase: RfpGenerationPhase,
  event: RfpGenerationEvent,
): RfpGenerationPhase {
  if (event === 'START') return 'generating';
  if (event === 'SERVER_SUCCEEDED') return 'loading_draft';
  if (event === 'RESET') return 'idle';
  return phase;
}

export function getRfpGenerationSuccessNotice(
  result: Pick<RFPGenerationResponse, 'message' | 'rfpResponseId' | 'sectionsGenerated'>,
) {
  const sectionLabel = `${result.sectionsGenerated} section${result.sectionsGenerated === 1 ? '' : 's'}`;
  return `${result.message} Draft #${result.rfpResponseId} is saved with ${sectionLabel}.`;
}

export function isRfpWorkspaceCurrent(
  activeResponseId: number | null | undefined,
  workspaceResponseId: number | null | undefined,
) {
  return Number.isSafeInteger(activeResponseId)
    && Number.isSafeInteger(workspaceResponseId)
    && activeResponseId === workspaceResponseId;
}

export type NaicsVerificationNotice = {
  title: string;
  message: string;
};

export function normalizeSixDigitNaicsCode(value: string | null | undefined) {
  const normalized = value?.trim().replace(/[\s-]+/g, '');
  return normalized && /^\d{6}$/.test(normalized) ? normalized : null;
}

export function resolveOpportunitySelection(
  currentSelection: string,
  opportunities: Array<Pick<Contract, 'noticeId'>>,
) {
  if (!currentSelection) return '';
  return opportunities.some(opportunity => opportunity.noticeId === currentSelection)
    ? currentSelection
    : '';
}

export function hasExactNaicsMatch(
  profileNaicsCodes: readonly string[] | null | undefined,
  opportunityNaicsCode: string | null | undefined,
) {
  const opportunityCode = normalizeSixDigitNaicsCode(opportunityNaicsCode);
  if (!opportunityCode) return false;

  return (profileNaicsCodes || []).some(
    code => normalizeSixDigitNaicsCode(String(code)) === opportunityCode,
  );
}

export function getNaicsVerificationNotice(
  profileNaicsCodes: readonly string[] | null | undefined,
  opportunityNaicsCode: string | null | undefined,
): NaicsVerificationNotice | null {
  const opportunityCode = normalizeSixDigitNaicsCode(opportunityNaicsCode);
  if (!opportunityCode) return null;

  const savedCodes = (profileNaicsCodes || [])
    .map(code => normalizeSixDigitNaicsCode(String(code)))
    .filter((code): code is string => Boolean(code));

  if (hasExactNaicsMatch(profileNaicsCodes, opportunityCode)) return null;

  if (!savedCodes.length) {
    return {
      title: 'NAICS verification pending',
      message: `No verified company NAICS codes are saved to compare with opportunity ${opportunityCode}. Review the company profile and save only eligible codes. Bid analysis remains available while verification is pending.`,
    };
  }

  return {
    title: 'NAICS verification pending',
    message: `The saved company NAICS codes do not include opportunity ${opportunityCode}. Confirm eligibility and add this code only if it is accurate. Bid analysis remains available while verification is pending.`,
  };
}
