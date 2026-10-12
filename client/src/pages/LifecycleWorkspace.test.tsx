// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../services/lifecycleApi', () => ({ lifecycleApi: {
  records: vi.fn(async () => [{ id: 'stored-review', reviewType: 'LIFECYCLE_READINESS', output: { approved: false, score: 0, note: '' }, status: 'REVIEW_REQUIRED', createdAt: '2026-01-01' }]),
  aiReview: run,
} }));
import { AiReviewPanel } from './LifecycleWorkspace';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); run.mockClear(); });

describe('lifecycle AI review', () => {
  it('fills a preset without generating and opens a saved structured report', async () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><AiReviewPanel matters={[{ id: 'real-matter-from-fixture', matterNumber: 'M-1', title: 'Review' } as any]} /></QueryClientProvider>); });
    const preset = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Clauses & Compliance'));
    expect(preset).toBeTruthy();
    await act(async () => { preset!.click(); });
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toContain('clause and compliance assessment');
    expect(run).not.toHaveBeenCalled();
    const saved = [...host.querySelectorAll('select')].find(select => select.querySelector('option[value="stored-review"]'))!;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!; setter.call(saved, 'stored-review'); saved.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.textContent).toContain('Approved');
    expect(host.textContent).toContain('(empty string)');
    await act(async () => { root.unmount(); });
  });
});
