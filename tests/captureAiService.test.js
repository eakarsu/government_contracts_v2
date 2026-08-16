'use strict';

const { CaptureAiService } = require('../services/captureAiService');

const completeReport = {
  summary: 'The pursuit is conditionally viable.',
  executiveDecision: { recommendation: 'Proceed to review', confidence: 0.81, rationale: 'Evidence supports fit.' },
  scenarioMetrics: [{ label: 'Win posture', value: '68%', interpretation: 'Competitive with mitigations.' }],
  riskAssessment: [{ finding: 'Past performance evidence requires validation.', severity: 'MEDIUM', evidence: 'Capture context' }],
  evidenceGaps: ['Authoritative solicitation attachments'],
  controls: [{ control: 'Independent review', status: 'OPEN', evidence: 'Not yet recorded', owner: 'Capture lead' }],
  recommendations: [{ action: 'Validate attachments', owner: 'Proposal manager', priority: 'HIGH', rationale: 'Close evidence gap.' }],
  humanDecision: 'Capture lead must approve the pursuit decision.',
};

test('capture AI sends evidence to OpenRouter and returns verifiable provider metadata', async () => {
  const fetchImpl = jest.fn(async () => ({
    ok: true,
    json: async () => ({ id: 'generation-123', choices: [{ message: { content: JSON.stringify(completeReport) } }], usage: { total_tokens: 456 } }),
  }));
  const service = new CaptureAiService({ fetchImpl, environment: {
    OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'test-model', OPENROUTER_BASE_URL: 'https://openrouter.example/api/v1',
  } });
  const result = await service.analyze({ analysisType: 'COMPREHENSIVE_CAPTURE_REVIEW', contract: { noticeId: 'ABC' }, userContext: { companyProfile: { hasBonding: true } }, localEvidence: { probability: 68 } });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][0]).toBe('https://openrouter.example/api/v1/chat/completions');
  const request = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(request.model).toBe('test-model');
  expect(request.response_format).toEqual({ type: 'json_object' });
  expect(request.messages[1].content).toContain('COMPREHENSIVE_CAPTURE_REVIEW');
  expect(result.report.summary).toBe(completeReport.summary);
  expect(result.metadata).toMatchObject({ provider: 'openrouter', model: 'test-model', providerResponseId: 'generation-123', localFallback: false });
});

test('capture AI fails honestly when OpenRouter is not configured', async () => {
  const service = new CaptureAiService({ environment: {}, fetchImpl: jest.fn() });
  await expect(service.analyze({})).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED', status: 503 });
});
