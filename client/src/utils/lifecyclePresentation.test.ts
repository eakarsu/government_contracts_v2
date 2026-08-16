import { describe, expect, it } from 'vitest';
import { formatLifecycleValue, statusTone, titleCase } from './lifecyclePresentation';

describe('lifecycle presentation', () => {
  it('turns API field names and states into professional labels', () => {
    expect(titleCase('riskAssessments')).toBe('Risk Assessments');
    expect(titleCase('PENDING_HUMAN_REVIEW')).toBe('PENDING HUMAN REVIEW');
  });

  it('formats evidence counts, confidence, and money without raw JSON', () => {
    expect(formatLifecycleValue('findings', [{ id: 1 }, { id: 2 }])).toBe('2 linked items');
    expect(formatLifecycleValue('confidence', 0.86)).toBe('86%');
    expect(formatLifecycleValue('estimatedValue', 125000)).toBe('$125,000');
  });

  it('uses clear status tones for risk and approval outcomes', () => {
    expect(statusTone('CRITICAL')).toBe('badge-error');
    expect(statusTone('APPROVED')).toBe('badge-success');
    expect(statusTone('IN_PROGRESS')).toBe('badge-info');
  });
});
