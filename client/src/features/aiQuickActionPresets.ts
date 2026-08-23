import type { UserContext } from '../services/aiService';
import type { Contract } from '../types';

export type AiQuickActionType = 'comprehensive' | 'probability' | 'similarity' | 'strategy';

export interface AiRequestForm {
  annualRevenue: number;
  certifications: string;
  experienceInNaics: string;
  agencyRelationships: string;
  pastWins: string;
  hasBonding: boolean;
  minContractValue: number;
  preferredNaicsCodes: string;
  preferredAgencies: string;
  preferredStates: string;
  keywords: string;
  maxAgeDays: number;
  opportunityNoticeId: string;
  opportunityTitle: string;
  opportunityAgency: string;
  opportunityNaicsCodes: string;
  opportunityClassification: string;
  opportunitySetAside: string;
  opportunityLocation: string;
  opportunityPostedDate: string;
  opportunityResponseDeadline: string;
  opportunityValue: number;
  opportunityDescription: string;
}

export interface AiRequestPreset {
  id: string;
  name: string;
  description: string;
  action: AiQuickActionType;
  values: AiRequestForm;
}

const complete = (overrides: Partial<AiRequestForm> = {}): AiRequestForm => ({
  annualRevenue: 8_500_000,
  certifications: '8(a), HUBZone, WOSB',
  experienceInNaics: '541511, 541512, 541519',
  agencyRelationships: 'Department of Defense, GSA, Department of Homeland Security',
  pastWins: 'Cloud modernization BPA, Zero-trust implementation, Data platform support',
  hasBonding: true,
  minContractValue: 100_000,
  preferredNaicsCodes: '541511, 541512, 541519',
  preferredAgencies: 'Department of Defense, GSA, Department of Homeland Security',
  preferredStates: 'VA, MD, DC',
  keywords: 'cybersecurity, cloud modernization, data analytics, software engineering',
  maxAgeDays: 45,
  opportunityNoticeId: '',
  opportunityTitle: '',
  opportunityAgency: '',
  opportunityNaicsCodes: '',
  opportunityClassification: '',
  opportunitySetAside: '',
  opportunityLocation: '',
  opportunityPostedDate: '',
  opportunityResponseDeadline: '',
  opportunityValue: 0,
  opportunityDescription: '',
  ...overrides,
});

export const AI_REQUEST_PRESETS: AiRequestPreset[] = [
  {
    id: 'capture-review',
    name: 'Full Capture Review',
    description: 'Complete pursuit, competition, pricing, and execution review.',
    action: 'comprehensive',
    values: complete(),
  },
  {
    id: 'win-probability',
    name: 'Win Probability',
    description: 'Emphasize qualifications, relationships, and relevant wins.',
    action: 'probability',
    values: complete({ minContractValue: 250_000, maxAgeDays: 30 }),
  },
  {
    id: 'market-intelligence',
    name: 'Similar Awards',
    description: 'Find comparable awards and agency buying patterns.',
    action: 'similarity',
    values: complete({ keywords: 'incumbent, recompete, award history, contract vehicle', maxAgeDays: 365 }),
  },
  {
    id: 'bid-strategy',
    name: 'Bid Strategy',
    description: 'Build pricing, staffing, risk, and execution recommendations.',
    action: 'strategy',
    values: complete({ keywords: 'price-to-win, staffing, transition, delivery risk', minContractValue: 500_000 }),
  },
  {
    id: 'small-business',
    name: 'Set-Aside Fit',
    description: 'Assess certification alignment and teaming posture.',
    action: 'probability',
    values: complete({ annualRevenue: 4_200_000, certifications: '8(a), HUBZone, WOSB, SDVOSB', keywords: 'set-aside, socioeconomic, mentor-protege, teaming' }),
  },
  {
    id: 'risk-review',
    name: 'Risk & Readiness',
    description: 'Stress-test bonding, delivery history, compliance, and recency.',
    action: 'comprehensive',
    values: complete({ keywords: 'compliance, bonding, past performance, delivery risk, security clearance', maxAgeDays: 21 }),
  },
];

const unique = (values: Array<string | null | undefined>) => [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];

function agencyNames(agency?: string) {
  return unique(String(agency || '').split('.')).slice(0, 4);
}

function opportunityStates(contract: Contract) {
  const sam = (contract.samData || {}) as Record<string, any>;
  const place = contract.placeOfPerformance || sam.placeOfPerformance;
  const placeState = typeof place?.state === 'object' ? place.state.code || place.state.name : place?.state;
  return unique([placeState, sam.officeAddress?.state]);
}

function opportunityLocation(contract: Contract) {
  const sam = (contract.samData || {}) as Record<string, any>;
  const place = contract.placeOfPerformance || sam.placeOfPerformance || {};
  const state = typeof place.state === 'object' ? place.state.code || place.state.name : place.state;
  const country = typeof place.country === 'object' ? place.country.code || place.country.name : place.country;
  return unique([place.city?.name || place.city, state, place.zip, country]).join(', ');
}

function opportunityKeywords(contract: Contract, presetKeywords: string) {
  const sam = (contract.samData || {}) as Record<string, any>;
  const stopWords = new Set(['and', 'the', 'for', 'from', 'with', 'this', 'that', 'services', 'service', 'contract', 'solicitation']);
  const titleWords = String(contract.title || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 2 && !stopWords.has(word.toLowerCase()))
    .slice(0, 10);
  return unique([
    ...titleWords,
    contract.naicsCode,
    contract.classificationCode,
    sam.type,
    sam.typeOfSetAsideDescription,
    ...presetKeywords.split(','),
  ]).join(', ');
}

function opportunityValue(contract: Contract) {
  const sam = (contract.samData || {}) as Record<string, any>;
  const candidates = [sam.award?.amount, sam.award?.value, sam.estimatedValue, sam.estimatedAwardAmount];
  for (const candidate of candidates) {
    const number = Number(String(candidate ?? '').replace(/[$,]/g, ''));
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

export function applyOpportunityContext(current: AiRequestForm, defaults: AiRequestForm, contract?: Contract): AiRequestForm {
  if (!contract) return { ...current };
  const sam = (contract.samData || {}) as Record<string, any>;
  const naicsCodes = unique([
    contract.naicsCode,
    ...(Array.isArray(sam.naicsCodes) ? sam.naicsCodes : []),
  ]);
  const agencies = agencyNames(contract.agency);
  const states = opportunityStates(contract);
  const value = opportunityValue(contract);
  const location = opportunityLocation(contract);
  const responseDeadline = contract.responseDeadline || sam.responseDeadLine || sam.responseDeadline || '';
  return {
    ...current,
    minContractValue: value ?? defaults.minContractValue,
    preferredNaicsCodes: naicsCodes.length ? naicsCodes.join(', ') : defaults.preferredNaicsCodes,
    preferredAgencies: agencies.length ? agencies.join(', ') : defaults.preferredAgencies,
    preferredStates: states.length ? states.join(', ') : defaults.preferredStates,
    keywords: opportunityKeywords(contract, defaults.keywords) || defaults.keywords,
    maxAgeDays: defaults.maxAgeDays,
    opportunityNoticeId: contract.noticeId,
    opportunityTitle: contract.title || '',
    opportunityAgency: contract.agency || '',
    opportunityNaicsCodes: naicsCodes.join(', '),
    opportunityClassification: contract.classificationCode || '',
    opportunitySetAside: sam.typeOfSetAsideDescription || contract.setAsideCode || sam.typeOfSetAside || '',
    opportunityLocation: location,
    opportunityPostedDate: contract.postedDate || sam.postedDate || '',
    opportunityResponseDeadline: String(responseDeadline),
    opportunityValue: value || 0,
    opportunityDescription: contract.description || sam.description || '',
  };
}

const list = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

export const toUserContext = (form: AiRequestForm): UserContext => ({
  companyProfile: {
    annualRevenue: Number(form.annualRevenue),
    certifications: list(form.certifications),
    experienceInNaics: list(form.experienceInNaics),
    agencyRelationships: list(form.agencyRelationships),
    pastWins: list(form.pastWins),
    hasBonding: form.hasBonding,
  },
  preferences: {
    minContractValue: Number(form.minContractValue),
    preferredNaicsCodes: list(form.preferredNaicsCodes),
    preferredAgencies: list(form.preferredAgencies),
    preferredStates: list(form.preferredStates),
    keywords: list(form.keywords),
    maxAgeDays: Number(form.maxAgeDays),
  },
  opportunityContext: {
    noticeId: form.opportunityNoticeId,
    title: form.opportunityTitle,
    agency: form.opportunityAgency,
    naicsCodes: list(form.opportunityNaicsCodes),
    classificationCode: form.opportunityClassification,
    setAside: form.opportunitySetAside,
    location: form.opportunityLocation,
    postedDate: form.opportunityPostedDate,
    responseDeadline: form.opportunityResponseDeadline,
    estimatedValue: Number(form.opportunityValue),
    description: form.opportunityDescription,
  },
});

export const hasCompleteAiRequest = (form: AiRequestForm) =>
  form.annualRevenue > 0 &&
  form.minContractValue >= 0 &&
  form.maxAgeDays > 0 &&
  [
    form.certifications,
    form.experienceInNaics,
    form.agencyRelationships,
    form.pastWins,
    form.preferredNaicsCodes,
    form.preferredAgencies,
    form.preferredStates,
    form.keywords,
  ].every(value => value.trim().length > 0);

export const contextStorageKey = (contractId: string) => `aiQuickActionContext:${contractId}`;
export const resultStorageKey = (type: AiQuickActionType, contractId: string) => `aiQuickActionResult:${type}:${contractId}`;
