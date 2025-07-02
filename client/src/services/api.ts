import axios, { AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import type {
  ApiResponse,
  Contract,
  IndexingJob,
  SearchResult,
  QueueStatus,
  ApiStatus,
  AppConfig,
  ContractFetchForm,
  SearchForm,
} from '@/types';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    
    // Don't show toast for certain endpoints
    const silentEndpoints = ['/status', '/config'];
    const isSilentEndpoint = silentEndpoints.some(endpoint => 
      error.config?.url?.includes(endpoint)
    );
    
    if (!isSilentEndpoint) {
      toast.error(message);
    }
    
    return Promise.reject(error);
  }
);

// API Service Class
class ApiService {
  // Configuration
  async getConfig(): Promise<AppConfig> {
    const response = await api.get<AppConfig>('/config');
    return response.data;
  }

  async getStatus(): Promise<ApiStatus> {
    const response = await api.get<ApiStatus>('/status');
    return response.data;
  }

  // Contracts
  async fetchContracts(data: ContractFetchForm): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/contracts/fetch', data);
    return response.data;
  }

  async indexContracts(limit: number = 100): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/contracts/index', { limit });
    return response.data;
  }

  async getContracts(page: number = 1, limit: number = 20): Promise<{ contracts: Contract[]; total: number }> {
    const response = await api.get<{ contracts: Contract[]; total: number }>(`/contracts?page=${page}&limit=${limit}`);
    return response.data;
  }

  async getContract(noticeId: string): Promise<Contract> {
    const response = await api.get<Contract>(`/contracts/${noticeId}`);
    return response.data;
  }

  async analyzeContract(noticeId: string): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>(`/contracts/${noticeId}/analyze`);
    return response.data;
  }

  // Search
  async searchContracts(data: SearchForm): Promise<SearchResult> {
    const response = await api.post<SearchResult>('/search', data);
    return response.data;
  }

  async getRecommendations(criteria: {
    naics_codes?: string[];
    agencies?: string[];
    keywords?: string[];
  }): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/recommendations', criteria);
    return response.data;
  }

  // Jobs
  async getJob(jobId: number): Promise<IndexingJob> {
    const response = await api.get<IndexingJob>(`/jobs/${jobId}`);
    return response.data;
  }

  async getJobs(page: number = 1, limit: number = 20): Promise<{ jobs: IndexingJob[]; total: number }> {
    const response = await api.get<{ jobs: IndexingJob[]; total: number }>(`/jobs?page=${page}&limit=${limit}`);
    return response.data;
  }

  // Documents
  async processDocuments(contractId?: string, limit: number = 50): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/process', { contract_id: contractId, limit });
    return response.data;
  }

  async processDocumentsNorshin(limit: number = 5): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/process-norshin', { limit });
    return response.data;
  }

  async queueDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue');
    return response.data;
  }

  async getQueueStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/documents/queue/status');
    return response.data;
  }

  async processQueuedDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process');
    return response.data;
  }

  async processQueueAsync(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process-async');
    return response.data;
  }

  async processQueueParallel(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process-parallel');
    return response.data;
  }

  async queueTestDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/test-mode');
    return response.data;
  }

  async processTestDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/test-process');
    return response.data;
  }

  async pauseQueue(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/pause');
    return response.data;
  }

  async resumeQueue(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/resume');
    return response.data;
  }

  async stopQueue(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/stop');
    return response.data;
  }

  async retryFailedDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/retry-failed');
    return response.data;
  }

  async indexCompletedDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/index-completed');
    return response.data;
  }

  async getNotifications(): Promise<ApiResponse> {
    const response = await api.get<ApiResponse>('/documents/notifications');
    return response.data;
  }

  async getProcessedDocuments(): Promise<ApiResponse> {
    const response = await api.get<ApiResponse>('/documents/processed');
    return response.data;
  }

  // File Upload
  async uploadDocument(file: File, customPrompt?: string, model?: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('document', file);
    if (customPrompt) formData.append('customPrompt', customPrompt);
    if (model) formData.append('model', model);

    const response = await api.post<ApiResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadMultipleDocuments(files: FileList, customPrompt?: string, model?: string): Promise<ApiResponse> {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('documents', file);
    });
    if (customPrompt) formData.append('customPrompt', customPrompt);
    if (model) formData.append('model', model);

    const response = await api.post<ApiResponse>('/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getStaticDocuments(): Promise<{ documents: any[] }> {
    const response = await api.get<{ documents: any[] }>('/documents');
    return response.data;
  }

  async processStaticDocument(filename: string, customPrompt?: string, model?: string): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/process-static', {
      filename,
      customPrompt,
      model,
    });
    return response.data;
  }

  // Admin
  async getStuckDocuments(): Promise<ApiResponse> {
    const response = await api.get<ApiResponse>('/admin/documents/stuck');
    return response.data;
  }

  async resetDocument(docId: number): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>(`/admin/documents/reset/${docId}`);
    return response.data;
  }

  async resetAllStuckDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/admin/documents/reset-all-stuck');
    return response.data;
  }
}

export const apiService = new ApiService();
export default api;
