const {
  isDashboardPollingRequest,
  isNonGenerativeAiRequest,
} = require('../middleware/rateLimiter');
const { loadConfig } = require('../config/env');

function request(method, originalUrl) {
  return { method, originalUrl };
}

test('dashboard polling uses the dedicated status limiter bucket', () => {
  expect(isDashboardPollingRequest(request('GET', '/api/status'))).toBe(true);
  expect(isDashboardPollingRequest(request('GET', '/api/documents/queue/status?fresh=true'))).toBe(true);
  expect(isDashboardPollingRequest(request('GET', '/api/jobs/25'))).toBe(true);
  expect(isDashboardPollingRequest(request('POST', '/api/ai/opportunity-predictions'))).toBe(true);
  expect(isDashboardPollingRequest(request('POST', '/api/contracts/fetch'))).toBe(false);
});

test('only non-generative dashboard AI endpoints bypass the paid-AI limiter', () => {
  expect(isNonGenerativeAiRequest(request('GET', '/api/ai/health'))).toBe(true);
  expect(isNonGenerativeAiRequest(request('POST', '/api/ai/opportunity-predictions'))).toBe(true);
  expect(isNonGenerativeAiRequest(request('POST', '/api/ai/optimize-strategy'))).toBe(false);
  expect(isNonGenerativeAiRequest(request('POST', '/api/rfp/generate'))).toBe(false);
});

test('default API limits support a complete pipeline without weakening AI limits', () => {
  const configuration = loadConfig({});
  expect(configuration.rateLimitMaxRequests).toBe(600);
  expect(configuration.statusRateLimitMaxRequests).toBe(300);
  expect(configuration.aiRateLimitMaxRequests).toBe(10);
});
