import type { UserContext } from '../services/aiService';

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
