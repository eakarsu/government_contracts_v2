import api from './api';

export type LifecycleRecord = Record<string, any> & { id: string };
export type LifecycleResource = { key: string; label: string; description: string; appendOnly: boolean };

export const lifecycleApi = {
  async catalog(): Promise<LifecycleResource[]> {
    const response = await api.get('/lifecycle/catalog');
    return response.data.resources;
  },
  async overview(): Promise<any> {
    const response = await api.get('/lifecycle/overview');
    return response.data;
  },
  async records(resource: string, search = ''): Promise<LifecycleRecord[]> {
    const response = await api.get(`/lifecycle/${resource}`, { params: search ? { search } : undefined });
    return response.data.records;
  },
  async createMatter(input: Record<string, any>): Promise<LifecycleRecord> {
    const response = await api.post('/lifecycle/matters', input);
    return response.data.record;
  },
  async transitionMatter(id: string, nextStage: string, rationale: string): Promise<LifecycleRecord> {
    const response = await api.post(`/lifecycle/matters/${id}/transition`, { nextStage, rationale });
    return response.data.record;
  },
  async aiReview(id: string, question: string): Promise<LifecycleRecord> {
    const response = await api.post(`/lifecycle/matters/${id}/ai-review`, { question, reviewType: 'LIFECYCLE_READINESS' });
    return response.data.record;
  },
  async createApproval(id: string, input: { step: string; decision: string; rationale: string }): Promise<LifecycleRecord> {
    const response = await api.post(`/lifecycle/matters/${id}/approvals`, input);
    return response.data.record;
  },
  async governanceOverview(): Promise<any> {
    const response = await api.get('/governance/overview');
    return response.data;
  },
  async governanceRecords(resource: 'policies' | 'sources' | 'evaluations'): Promise<LifecycleRecord[]> {
    const response = await api.get(`/governance/${resource}`);
    return response.data.records;
  },
};
