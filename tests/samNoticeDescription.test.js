const {
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  resolveSamNoticeDescription,
  sanitizeSamDescriptionHtml,
  trustedNoticeDescriptionUrl,
} = require('../services/samNoticeDescription');

const sourceUrl = 'https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc123';

test('resolves a trusted SAM notice description with bounded, credentialed HTTP options', async () => {
  const get = jest.fn().mockResolvedValue({
    data: JSON.stringify({
      description: '<h2>Intent to Sole Source</h2><p>Axiom will provide R&amp;D support.<br>Responses are due Friday.</p>',
    }),
  });

  const result = await resolveSamNoticeDescription(`${sourceUrl}&api_key=provider-supplied&redirect=https://evil.test`, {
    apiKey: 'configured-key',
    httpClient: { get },
  });

  expect(result).toEqual({
    description: 'Intent to Sole Source\nAxiom will provide R&D support.\nResponses are due Friday.',
    sourceUrl: `${sourceUrl}&api_key=provider-supplied&redirect=https://evil.test`,
    status: 'resolved',
  });
  expect(get).toHaveBeenCalledTimes(1);
  const [requestedUrl, options] = get.mock.calls[0];
  expect(requestedUrl).toBe(sourceUrl);
  expect(requestedUrl).not.toContain('provider-supplied');
  expect(options).toMatchObject({
    headers: { Accept: 'application/json' },
    maxBodyLength: DEFAULT_MAX_BYTES,
    maxContentLength: DEFAULT_MAX_BYTES,
    maxRedirects: 0,
    params: { api_key: 'configured-key' },
    timeout: DEFAULT_TIMEOUT_MS,
  });
});

test('falls back to existing useful text when the trusted SAM request fails', async () => {
  const get = jest.fn().mockRejectedValue(new Error('upstream timeout containing sensitive request details'));
  const result = await resolveSamNoticeDescription(sourceUrl, {
    apiKey: 'configured-key',
    fallbackDescription: '<p>Previously verified description.</p>',
    httpClient: { get },
  });

  expect(result).toEqual({
    description: 'Previously verified description.',
    sourceUrl,
    status: 'fetch_failed',
  });
});

test.each([
  'http://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc123',
  'https://api.sam.gov.evil.test/prod/opportunities/v1/noticedesc?noticeid=abc123',
  'https://api.sam.gov@169.254.169.254/latest/meta-data?noticeid=abc123',
  'https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc123#fragment',
  'https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=../../metadata',
])('does not request an untrusted or malformed description URL: %s', async untrustedUrl => {
  const get = jest.fn();
  const result = await resolveSamNoticeDescription(untrustedUrl, {
    apiKey: 'configured-key',
    fallbackDescription: 'Existing verified evidence.',
    httpClient: { get },
  });

  expect(result.status).toBe('untrusted_url');
  expect(result.description).toBe('Existing verified evidence.');
  expect(get).not.toHaveBeenCalled();
  expect(trustedNoticeDescriptionUrl(untrustedUrl)).toBeNull();
});

test('sanitizes HTML into structured plain text without active or hidden content', () => {
  const html = `
    <html><head><title>Hidden title</title></head><body>
      <h1>Statement&nbsp;of Work</h1>
      <script>stealCredentials()</script>
      <style>.secret { display:none }</style>
      <p>Provide data &amp; AI services.</p>
      <ul><li>Secure hosting</li><li>Audit trail &#x2713;</li></ul>
      <!-- internal comment -->
    </body></html>`;

  const result = sanitizeSamDescriptionHtml(html);
  expect(result).toBe('Statement of Work\nProvide data & AI services.\n\u2022 Secure hosting\n\u2022 Audit trail ✓');
  expect(result).not.toMatch(/stealCredentials|display:none|Hidden title|<[^>]+>/);
});

test('rejects a response that exceeds the byte cap even when the HTTP client ignores its limit', async () => {
  const get = jest.fn().mockResolvedValue({ data: 'x'.repeat(2049) });
  const result = await resolveSamNoticeDescription(sourceUrl, {
    apiKey: 'configured-key',
    httpClient: { get },
    maxBytes: 2048,
  });
  expect(result.status).toBe('fetch_failed');
  expect(result.description).toBeNull();
});
