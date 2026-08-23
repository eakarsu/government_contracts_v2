import api from './api';

export type SuiteCapability = { key: string; label: string };
export type SuiteDomain = { slug: string; key: string; label: string; sourceProject: string; description: string; capabilities: SuiteCapability[] };
export type SuiteSource = { project: string; disposition: string; note: string };
export type SuiteCatalog = { domains: SuiteDomain[]; sources: SuiteSource[]; duplicatePolicy: string };
export type SuiteWorkItem = Record<string, any> & { id: string; domain: string; capability: string; title: string; summary: string; status: string; riskLevel: string };
export type SuiteAiReviewInput = {
  question: string;
  analysisType: string;
  objective: string;
  audience: string;
  riskTolerance: string;
  focusAreas: string[];
  assumptions: string;
  evidenceRequirements: string;
  jurisdiction: string;
  deadline: string;
  financialThreshold: string;
  outputTone: string;
  requestedSections: string[];
};

export const contractSuiteApi = {
  async catalog(): Promise<SuiteCatalog> {
    const response = await api.get('/contract-suite/catalog');
    return response.data;
  },
  async overview(): Promise<Record<string, any>> {
    const response = await api.get('/contract-suite/overview');
    return response.data;
  },
  async workItems(params: { domain?: string; capability?: string; search?: string }): Promise<SuiteWorkItem[]> {
    const response = await api.get('/contract-suite/work-items', { params });
    return response.data.records;
  },
  async workItem(id: string): Promise<SuiteWorkItem> {
    const response = await api.get(`/contract-suite/work-items/${id}`);
    return response.data.record;
  },
  async create(input: Record<string, any>): Promise<SuiteWorkItem> {
    const response = await api.post('/contract-suite/work-items', input);
    return response.data.record;
  },
  async update(id: string, input: Record<string, any>): Promise<SuiteWorkItem> {
    const response = await api.patch(`/contract-suite/work-items/${id}`, input);
    return response.data.record;
  },
  async delete(id: string): Promise<{ id: string }> {
    const response = await api.delete(`/contract-suite/work-items/${id}`);
    return response.data.record;
  },
  async transition(id: string, nextStatus: string, rationale: string): Promise<SuiteWorkItem> {
    const response = await api.post(`/contract-suite/work-items/${id}/transition`, { nextStatus, rationale });
    return response.data.record;
  },
  async aiReview(id: string, input: SuiteAiReviewInput): Promise<Record<string, any>> {
    const response = await api.post(`/contract-suite/work-items/${id}/ai-review`, input);
    return response.data.record;
  },
};
