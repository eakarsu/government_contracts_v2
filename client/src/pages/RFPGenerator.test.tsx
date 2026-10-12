// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('../services/api', () => ({ apiService: {
  getContracts: vi.fn(async () => ({ success: true, data: [{ noticeId: 'real-record-from-fixture', title: 'Agency platform', agency: 'Agency', resourceLinks: [] }] })),
  getRFPTemplates: vi.fn(async () => ({ success: true, templates: [{ id: 42, name: 'Agency template', agency: 'Agency', sections: [] }] })),
  getCompanyProfiles: vi.fn(async () => ({ success: true, profiles: [{ id: 77, name: 'Example company', pastPerformance: [], keyPersonnel: [], capabilities: {} }] })),
  generateRFPResponse: generate,
} }));
import RFPGenerator from './RFPGenerator';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); generate.mockClear(); });

describe('RFP prompt presets', () => {
  it('fills both optional prompt fields without generating or changing selected records', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<MemoryRouter><RFPGenerator /></MemoryRouter>); });
    const contract = host.querySelector('select') as HTMLSelectElement;
    expect(contract.value).toBe('real-record-from-fixture');
    const preset = [...host.querySelectorAll('button')].find(button => button.textContent === 'Technical response');
    expect(preset).toBeTruthy();
    await act(async () => { preset!.click(); });
    expect(contract.value).toBe('real-record-from-fixture');
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toContain('measurable deliverables');
    expect([...host.querySelectorAll('input[type="text"]')].some(input => (input as HTMLInputElement).value === 'Staffing and transition')).toBe(true);
    expect(generate).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });
});
