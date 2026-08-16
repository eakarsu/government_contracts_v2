'use strict';

const { parseStructuredOutput } = require('./contractSuiteService');

class CaptureAiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class CaptureAiService {
  constructor({ fetchImpl = global.fetch, environment = process.env } = {}) {
    this.fetch = fetchImpl;
    this.environment = environment;
  }

  configuration() {
    const apiKey = this.environment.OPENROUTER_API_KEY;
    const model = this.environment.OPENROUTER_MODEL;
    const baseUrl = this.environment.OPENROUTER_BASE_URL;
    if (!apiKey || !model || !baseUrl) {
      throw new CaptureAiError('AI_NOT_CONFIGURED', 'OpenRouter AI is not configured', 503);
    }
    return { apiKey, model, baseUrl: baseUrl.replace(/\/$/, '') };
  }

  status() {
    try {
      const { model, baseUrl } = this.configuration();
      return { configured: true, provider: 'openrouter', model, baseUrl };
    } catch (_error) {
      return { configured: false, provider: 'openrouter', model: null, baseUrl: null };
    }
  }

  async analyze({ analysisType, contract, userContext, localEvidence }) {
    const { apiKey, model, baseUrl } = this.configuration();
    const startedAt = Date.now();
    const evidence = JSON.stringify({ analysisType, contract, companyAndCaptureContext: userContext, analyticalEvidence: localEvidence });
    const response = await this.fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.environment.FRONTEND_PUBLIC_ORIGIN || 'https://chipdesign.shop',
        'X-Title': 'Government Contract Intelligence',
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a senior US government-contract capture advisor. Use only the supplied evidence. Return one concise JSON object with exactly these professional report sections: summary (string); executiveDecision ({recommendation, confidence, rationale}); scenarioMetrics (array of {label,value,interpretation}); riskAssessment (array of {finding,severity,evidence}); evidenceGaps (string array); controls (array of {control,status,evidence,owner}); recommendations (array of {action,owner,priority,rationale}); humanDecision (string). Include every section, limit each array to five focused entries, distinguish calculated evidence from judgment, never invent facts, and require authorized human review. Never wrap JSON in Markdown.',
          },
          { role: 'user', content: evidence.slice(0, 60_000) },
        ],
      }),
    });

    if (!response.ok) {
      const providerMessage = await response.text().catch(() => '');
      throw new CaptureAiError('AI_PROVIDER_ERROR', `OpenRouter returned ${response.status}${providerMessage ? `: ${providerMessage.slice(0, 240)}` : ''}`, 502);
    }
    const payload = await response.json();
    const raw = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!raw) throw new CaptureAiError('AI_EMPTY_RESPONSE', 'OpenRouter returned an empty response', 502);

    let report;
    try {
      report = parseStructuredOutput(raw);
    } catch (error) {
      throw new CaptureAiError('AI_INVALID_RESPONSE', error.message || 'OpenRouter returned an invalid structured report', 502);
    }
    return {
      report,
      metadata: {
        provider: 'openrouter',
        model,
        providerResponseId: payload.id || null,
        elapsedMs: Date.now() - startedAt,
        generatedAt: new Date().toISOString(),
        localFallback: false,
        usage: payload.usage || null,
      },
    };
  }
}

module.exports = { CaptureAiService, CaptureAiError, captureAiService: new CaptureAiService() };
