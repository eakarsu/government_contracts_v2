// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthGate from './AuthGate';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); document.body.innerHTML = ''; });

describe('demo login', () => {
  it('requests configured demo credentials only after clicking and logs in once', async () => {
    const calls: string[] = [];
    const demo = { email: ['demo', 'example.test'].join('@'), password: ['test', 'only'].join('-') };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      calls.push(path);
      if (path === '/api/auth/config') return { ok: true, json: async () => ({ mode: 'local' }) };
      if (path === '/api/auth/demo-credentials') return { ok: true, json: async () => demo };
      if (path === '/api/auth/login') {
        expect(JSON.parse(String(options?.body))).toEqual(demo);
        return { ok: true, json: async () => ({ token: 'test-session' }) };
      }
      if (path === '/api/auth/me') return { ok: true, json: async () => ({ user: { id: 'test-user' } }) };
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><AuthGate><div>Signed in</div></AuthGate></QueryClientProvider>); });
    expect(calls).toEqual(['/api/auth/config']);
    const button = [...host.querySelectorAll('button')].find(item => item.textContent === 'Log In as Demo');
    expect(button).toBeTruthy();
    await act(async () => { button!.click(); });
    expect(calls).toEqual(['/api/auth/config', '/api/auth/demo-credentials', '/api/auth/login', '/api/auth/me']);
    expect(host.textContent).toContain('Signed in');
    await act(async () => { root.unmount(); });
  });

  it('shows an explicit limitation when demo credentials are unavailable', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/auth/config') return { ok: true, json: async () => ({ mode: 'local' }) };
      if (path === '/api/auth/demo-credentials') return { ok: false, status: 503 };
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><AuthGate><div>Signed in</div></AuthGate></QueryClientProvider>); });
    const button = [...host.querySelectorAll('button')].find(item => item.textContent === 'Log In as Demo');
    await act(async () => { button!.click(); });
    expect(host.textContent).toContain('Demo credentials are unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { root.unmount(); });
  });
});
