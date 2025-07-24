import api from './api';

class NLPApiService {
  // Natural Language Processing API Methods
  async naturalLanguageSearch(data: {
    query: string;
    userContext?: any;
    includeSemantic?: boolean;
  }): Promise<{
    success: boolean;
    query: string;
    explanation: string;
    results: any[];
    totalCount: number;
    parsedQuery: any;
  }> {
    const response = await api.post('/nlp/natural', data);
    return response.data;
  }

  async getNLPSuggestions(query?: string): Promise<{
    suggestions: string[];
  }> {
    const params = query ? `?q=${encodeURIComponent(query)}` : '';
    const response = await api.get(`/nlp/suggestions${params}`);
    return response.data;
  }

  async validateNLPQuery(query: string): Promise<{
    valid: boolean;
    parsed: any;
    issues: string[];
  }> {
    const response = await api.post('/nlp/validate', { query });
    return response.data;
  }

  async classifyIntent(query: string): Promise<{
    intent: string;
    confidence: number;
    sub_intent: string;
  }> {
    const response = await api.post('/nlp/classify-intent', { query });
    return response.data;
  }

  async extractEntities(text: string): Promise<{
    entities: any;
    structured: any;
  }> {
    const response = await api.post('/nlp/extract-entities', { text });
    return response.data;
  }

  async getPersonalizedSuggestions(userContext?: any): Promise<{
    suggestions: any[];
  }> {
    const response = await api.post('/nlp/personalized-suggestions', { userContext });
    return response.data;
  }
}

export const nlpApi = new NLPApiService();
export default nlpApi;