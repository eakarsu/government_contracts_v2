const axios = require('axios');

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 256 * 1024;
const TRUSTED_HOSTNAME = 'api.sam.gov';
const TRUSTED_PATH = /^\/(?:prod\/)?opportunities\/v\d+\/noticedesc\/?$/;

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    bull: '•',
    gt: '>',
    hellip: '…',
    lt: '<',
    mdash: '—',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, token) => {
    if (token[0] !== '#') return named[token.toLowerCase()] ?? entity;
    const radix = token[1]?.toLowerCase() === 'x' ? 16 : 10;
    const digits = radix === 16 ? token.slice(2) : token.slice(1);
    const codePoint = Number.parseInt(digits, radix);
    if (!Number.isSafeInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return '';
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return '';
    }
  });
}

function sanitizeSamDescriptionHtml(value) {
  if (value === undefined || value === null) return null;
  let text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  text = text
    .replace(/\u0000/g, '')
    .replace(/>\s+</g, '><')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template|noscript|head)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*hr\b[^>]*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n• ')
    .replace(/<\s*\/(?:address|article|aside|blockquote|div|dl|dt|dd|fieldset|figcaption|figure|footer|form|h[1-6]|header|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  text = decodeHtmlEntities(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return text || null;
}

function trustedNoticeDescriptionUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const noticeId = url.searchParams.get('noticeid');
    if (
      url.protocol !== 'https:'
      || url.hostname !== TRUSTED_HOSTNAME
      || url.port
      || url.username
      || url.password
      || url.hash
      || !TRUSTED_PATH.test(url.pathname)
      || !noticeId
      || !/^[a-z0-9_-]{1,128}$/i.test(noticeId)
    ) return null;

    // Rebuild the URL from allowlisted components. This deliberately drops
    // provider data such as api_key, redirect targets, and unexpected query
    // parameters before the server adds its own configured credential.
    const trusted = new URL(`https://${TRUSTED_HOSTNAME}${url.pathname}`);
    trusted.searchParams.set('noticeid', noticeId);
    return trusted;
  } catch {
    return null;
  }
}

function absoluteUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol ? url : null;
  } catch {
    return null;
  }
}

function usefulFallback(value) {
  if (absoluteUrl(value)) return null;
  return sanitizeSamDescriptionHtml(value);
}

function responseText(data) {
  if (Buffer.isBuffer(data)) data = data.toString('utf8');
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{')) {
      try {
        return responseText(JSON.parse(trimmed));
      } catch {
        return data;
      }
    }
    return data;
  }
  if (!data || typeof data !== 'object') return null;
  if (typeof data.description === 'string') return data.description;
  if (typeof data.content === 'string') return data.content;
  if (typeof data.data?.description === 'string') return data.data.description;
  return null;
}

/**
 * Resolve a SAM search-result description into bounded plain text.
 *
 * The returned sourceUrl is evidence metadata only. Callers should retain the
 * original SAM record unchanged and store `description` in the searchable
 * Contract field.
 */
async function resolveSamNoticeDescription(rawDescription, {
  apiKey,
  fallbackDescription = null,
  httpClient = axios,
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const fallback = usefulFallback(fallbackDescription);
  const trustedUrl = trustedNoticeDescriptionUrl(rawDescription);

  if (!trustedUrl) {
    if (absoluteUrl(rawDescription)) {
      return {
        description: fallback,
        sourceUrl: String(rawDescription).trim(),
        status: 'untrusted_url',
      };
    }
    return {
      description: sanitizeSamDescriptionHtml(rawDescription) || fallback,
      sourceUrl: null,
      status: rawDescription ? 'inline' : 'empty',
    };
  }

  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return {
      description: fallback,
      sourceUrl: String(rawDescription).trim(),
      status: 'missing_api_key',
    };
  }

  const boundedMaxBytes = Math.max(1024, Math.min(Number(maxBytes) || DEFAULT_MAX_BYTES, DEFAULT_MAX_BYTES));
  const boundedTimeoutMs = Math.max(250, Math.min(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS));

  try {
    const response = await httpClient.get(trustedUrl.toString(), {
      headers: { Accept: 'text/html, text/plain, application/json' },
      maxBodyLength: boundedMaxBytes,
      maxContentLength: boundedMaxBytes,
      maxRedirects: 0,
      params: { api_key: apiKey.trim() },
      responseType: 'text',
      timeout: boundedTimeoutMs,
    });
    const body = responseText(response.data);
    if (body === null || Buffer.byteLength(body) > boundedMaxBytes) throw new Error('invalid_response_size');
    const description = sanitizeSamDescriptionHtml(body);
    if (!description) throw new Error('empty_description');
    return {
      description,
      sourceUrl: String(rawDescription).trim(),
      status: 'resolved',
    };
  } catch {
    return {
      description: fallback,
      sourceUrl: String(rawDescription).trim(),
      status: 'fetch_failed',
    };
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  resolveSamNoticeDescription,
  sanitizeSamDescriptionHtml,
  trustedNoticeDescriptionUrl,
};
