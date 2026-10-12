// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getContracts, generate } = vi.hoisted(() => ({ getContracts: vi.fn(), generate: vi.fn() }));
vi.mock('../services/contractsApi', () => ({ contractsApi: { getContracts } }));
vi.mock('../services/aiService', () => ({ aiService: { getComprehensiveAnalysis: generate } }));
vi.mock('../components/AuthGate', () => ({ useAuth: () => ({ user: { id: 'fixture-user' } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
import AIQuickActionsPage from './AIQuickActionsPage';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); sessionStorage.clear(); getContracts.mockReset(); generate.mockReset(); });

describe('AI Capture Studio record selector', () => {
  it('renders 16 project demo opportunities and keeps a preset click fill-only', async () => {
    const contracts = Array.from({ length: 16 }, (_, index) => ({
      id: index + 1,
      noticeId: `AI-DEMO-${String(index + 1).padStart(3, '0')}`,
      title: `Government opportunity ${index + 1}`,
      agency: 'General Services Administration',
      naicsCode: '541511',
      description: 'Federal IT services',
      postedDate: '2026-09-01',
    }));
    getContracts.mockResolvedValue({ success: true, data: contracts, pagination: { page: 1, limit: 100, total: 16, totalPages: 1 } });
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><AIQuickActionsPage /></QueryClientProvider>); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const selector = host.querySelector('select[aria-label="Contract for AI analysis"]') as HTMLSelectElement;
    expect(selector.options).toHaveLength(16);
    expect(selector.options[15].value).toBe('AI-DEMO-016');
    const preset = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('AI context · fills Step 3') && !button.textContent?.includes('Comprehensive'));
    expect(preset).toBeTruthy();
    await act(async () => { preset!.click(); });
    expect(generate).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });
});
