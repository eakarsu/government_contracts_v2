import { describe, expect, it } from 'vitest';
import { AI_PRESETS, buildReviewInput } from './ContractSuiteWorkspace';

const record: any = {
  id: 'smart-1', domain: 'SMART_CONTRACT', capability: 'source-audit', title: 'Source audit', summary: 'Review source',
  status: 'OPEN', riskLevel: 'HIGH', jurisdiction: 'MULTICHAIN', dueDate: '2026-09-15T00:00:00.000Z', monetaryValue: 750000,
};

describe('contract suite AI presets', () => {
  it('provides multiple Smart-Contract Assurance actions', () => {
    expect(AI_PRESETS.SMART_CONTRACT.length).toBeGreaterThanOrEqual(6);
  });

  it('fills every AI request field for every domain preset', () => {
    for (const [domain, presets] of Object.entries(AI_PRESETS)) {
      for (const preset of presets) {
        const input = buildReviewInput({ ...record, domain }, preset);
        for (const [field, value] of Object.entries(input)) {
          if (Array.isArray(value)) expect(value.length, `${domain}/${preset.id}/${field}`).toBeGreaterThan(0);
          else expect(String(value).trim().length, `${domain}/${preset.id}/${field}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
