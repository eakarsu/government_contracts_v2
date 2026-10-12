// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../services/api', () => ({ apiService: {
  getQueueStatus: vi.fn(async () => ({})), getDocumentStats: vi.fn(async () => ({})), getFileTypes: vi.fn(async () => ({})),
  getDownloadStatus: vi.fn(async () => ({ success: true, download_jobs: [], folder_stats: null, download_path: '' })),
  uploadMultipleDocuments: upload,
} }));
import Documents from './Documents';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ''; upload.mockClear(); });

describe('document analysis presets', () => {
  it('fills the optional prompt and preserves an uploaded file without submitting', async () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><Documents /></QueryClientProvider>); });
    const uploadTab = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Upload'));
    expect(uploadTab).toBeTruthy();
    await act(async () => { uploadTab!.click(); });
    const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fixture'], 'sample.txt', { type: 'text/plain' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: { 0: file, length: 1, item: () => file } });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });
    const preset = [...host.querySelectorAll('button')].find(button => button.textContent === 'Compliance');
    expect(preset).toBeTruthy();
    await act(async () => { preset!.click(); });
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toContain('compliance obligations');
    expect((host.querySelector('input[placeholder="e.g., gpt-4"]') as HTMLInputElement).value).toBe('Configured service default');
    expect(fileInput.files?.[0]).toBe(file);
    expect(upload).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });
});
