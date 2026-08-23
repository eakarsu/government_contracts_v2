import api from './api';

export type LifecycleRecord = Record<string, any> & { id: string };
export type LifecycleResource = { key: string; label: string; description: string; appendOnly: boolean; editableFields: string[]; canEdit: boolean; canDelete: boolean };

export const lifecycleApi = {
  async catalog(): Promise<LifecycleResource[]> {
    const response = await api.get('/lifecycle/catalog');
    return response.data.resources;
  },
  async overview(): Promise<any> {
    const response = await api.get('/lifecycle/overview');
    return response.data;
  },
  async records(resource: string, search = '', matterId = ''): Promise<LifecycleRecord[]> {
    const params = { ...(search ? { search } : {}), ...(matterId ? { matterId } : {}) };
    const response = await api.get(`/lifecycle/${resource}`, { params: Object.keys(params).length ? params : undefined });
    return response.data.records;
  },
  async createMatter(input: Record<string, any>): Promise<LifecycleRecord> {
    const response = await api.post('/lifecycle/matters', input);
    return response.data.record;
  },
  async updateRecord(resource: string, id: string, input: Record<string, any>): Promise<LifecycleRecord> {
    const response = await api.patch(`/lifecycle/${resource}/${id}`, input);
    return response.data.record;
  },
  async deleteRecord(resource: string, id: string): Promise<{ id: string }> {
    const response = await api.delete(`/lifecycle/${resource}/${id}`);
    return response.data.record;
  },
  async transitionMatter(id: string, nextStage: string, rationale: string): Promise<LifecycleRecord> {
    const response = await api.post(`/lifecycle/matters/${id}/transition`, { nextStage, rationale });
    return response.data.record;
  },
  async aiReview(id: string, input: { question: string; reviewType: string; chainPrevious: boolean; previousReviewId?: string | null }): Promise<LifecycleRecord> {
    const response = await api.post(`/lifecycle/matters/${id}/ai-review`, input);
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
