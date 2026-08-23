import { describe, expect, it, vi } from 'vitest';
import type { RFPGenerationResponse } from '../types';
import { runRfpGenerationFlow } from './rfpGenerationFlow';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const generated: RFPGenerationResponse = {
  success: true,
  rfpResponseId: 5,
  generationTime: 280,
  sectionsGenerated: 17,
  complianceScore: 80,
  predictedScore: null,
  reused: false,
  reuseReason: null,
  message: 'Proposal application draft generated. Human review is required before submission.',
};

describe('RFP generation flow', () => {
  it('ends the generating phase before the completed draft finishes loading', async () => {
    const generation = deferred<RFPGenerationResponse>();
    const draft = deferred<{ id: number }>();
    const phases: string[] = [];
    const onGenerated = vi.fn();
    const onDraftLoaded = vi.fn();
    const loadDraft = vi.fn(() => draft.promise);

    const flow = runRfpGenerationFlow({
      generate: () => generation.promise,
      loadDraft,
      onPhase: event => phases.push(event),
      onGenerated,
      onDraftLoaded,
      onGenerationError: vi.fn(),
      onDraftLoadError: vi.fn(),
    });

    expect(phases).toEqual(['START']);
    generation.resolve(generated);
    await Promise.resolve();
    await Promise.resolve();

    expect(phases).toEqual(['START', 'SERVER_SUCCEEDED']);
    expect(onGenerated).toHaveBeenCalledWith(generated);
    expect(loadDraft).toHaveBeenCalledTimes(1);
    expect(loadDraft).toHaveBeenCalledWith(5);
    expect(onDraftLoaded).not.toHaveBeenCalled();

    draft.resolve({ id: 5 });
    await expect(flow).resolves.toMatchObject({ status: 'complete' });
    expect(onDraftLoaded).toHaveBeenCalledWith({ id: 5 }, generated);
    expect(phases).toEqual(['START', 'SERVER_SUCCEEDED', 'RESET']);
  });

  it('resets without attempting hydration when generation fails', async () => {
    const error = new Error('provider unavailable');
    const loadDraft = vi.fn();
    const onGenerationError = vi.fn();
    const phases: string[] = [];

    const result = await runRfpGenerationFlow({
      generate: () => Promise.reject(error),
      loadDraft,
      onPhase: event => phases.push(event),
      onGenerated: vi.fn(),
      onDraftLoaded: vi.fn(),
      onGenerationError,
      onDraftLoadError: vi.fn(),
    });

    expect(result.status).toBe('generation_failed');
    expect(loadDraft).not.toHaveBeenCalled();
    expect(onGenerationError).toHaveBeenCalledWith(error);
    expect(phases).toEqual(['START', 'RESET']);
  });

  it('keeps the saved result and resets when draft hydration fails', async () => {
    const error = new Error('mobile connection paused');
    const onGenerated = vi.fn();
    const onDraftLoadError = vi.fn();
    const phases: string[] = [];

    const result = await runRfpGenerationFlow({
      generate: () => Promise.resolve({ ...generated, reused: true, reuseReason: 'recently_completed' }),
      loadDraft: () => Promise.reject(error),
      onPhase: event => phases.push(event),
      onGenerated,
      onDraftLoaded: vi.fn(),
      onGenerationError: vi.fn(),
      onDraftLoadError,
    });

    expect(result.status).toBe('draft_load_failed');
    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(onDraftLoadError).toHaveBeenCalledWith(error, expect.objectContaining({ reused: true }));
    expect(phases).toEqual(['START', 'SERVER_SUCCEEDED', 'RESET']);
  });
});
