// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('../services/api', () => ({ apiService: { getNLPSuggestions: vi.fn(async () => ({ suggestions: [] })), naturalLanguageSearch: search } }));
import NLPSearch from './NLPSearch';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ''; search.mockClear(); });

describe('NLP search presets', () => {
  it('fills the question and leaves search as a separate action', async () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><NLPSearch /></QueryClientProvider>); });
    const example = [...host.querySelectorAll('button')].find(button => button.textContent === 'IT contracts under $500K');
    expect(example).toBeTruthy();
    await act(async () => { example!.click(); });
    expect((host.querySelector('input[placeholder="Ask me anything about government contracts..."]') as HTMLInputElement).value).toBe('IT contracts under $500K');
    expect(search).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });
});
