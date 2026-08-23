import type { RFPGenerationResponse } from '../types';
import type { RfpGenerationEvent } from './rfpDashboardPresentation';

type GenerationFlowHandlers<TDraft> = {
  generate: () => Promise<RFPGenerationResponse>;
  loadDraft: (responseId: number) => Promise<TDraft>;
  onPhase: (event: RfpGenerationEvent) => void;
  onGenerated: (result: RFPGenerationResponse) => void;
  onDraftLoaded: (draft: TDraft, result: RFPGenerationResponse) => void;
  onGenerationError: (error: unknown) => void;
  onDraftLoadError: (error: unknown, result: RFPGenerationResponse) => void;
};

export type GenerationFlowResult<TDraft> =
  | { status: 'complete'; generated: RFPGenerationResponse; draft: TDraft }
  | { status: 'generation_failed'; error: unknown }
  | { status: 'draft_load_failed'; generated: RFPGenerationResponse; error: unknown };

export async function runRfpGenerationFlow<TDraft>(
  handlers: GenerationFlowHandlers<TDraft>,
): Promise<GenerationFlowResult<TDraft>> {
  handlers.onPhase('START');

  let generated: RFPGenerationResponse;
  try {
    generated = await handlers.generate();
  } catch (error) {
    handlers.onGenerationError(error);
    handlers.onPhase('RESET');
    return { status: 'generation_failed', error };
  }

  handlers.onPhase('SERVER_SUCCEEDED');
  handlers.onGenerated(generated);

  try {
    const draft = await handlers.loadDraft(generated.rfpResponseId);
    handlers.onDraftLoaded(draft, generated);
    return { status: 'complete', generated, draft };
  } catch (error) {
    handlers.onDraftLoadError(error, generated);
    return { status: 'draft_load_failed', generated, error };
  } finally {
    handlers.onPhase('RESET');
  }
}
