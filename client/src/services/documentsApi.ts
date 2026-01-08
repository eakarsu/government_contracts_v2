import api from './api';
import type { 
  ApiResponse, 
  QueueStatus, 
  DocumentSearchForm, 
  DocumentSearchResponse, 
  DocumentStats, 
  FileTypesResponse 
} from '../types';

export class DocumentsApiService {
  // Document processing
  async processDocuments(contractId?: string, limit: number = 50): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/documents/process', { contract_id: contractId, limit }, {
        timeout: 3600000 // 1 hour timeout
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data && typeof error.response.data === 'string') {
        throw new Error(`Server error: ${error.response.data}`);
      }
      throw error;
    }
  }

  async processDocumentsNorshin(limit: number = 5): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/process-norshin', { limit });
    return response.data;
  }

  async queueDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue', {}, {
      timeout: 3600000
    });
    return response.data;
  }

  async getQueueStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/documents/queue/status');
    return response.data;
  }

  async processQueuedDocuments(options?: { test_limit?: number }): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process', {
      concurrency: 3,
      batch_size: 3,
      process_all: false,
      test_limit: options?.test_limit || 3
    }, {
      timeout: 3600000 // 1 hour timeout
    });
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

  async resetQueue(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/reset');
    return response.data;
  }

  async searchDocuments(searchForm: DocumentSearchForm): Promise<DocumentSearchResponse> {
    const response = await api.post<DocumentSearchResponse>('/documents/search/advanced', {
      query: searchForm.query,
      limit: searchForm.limit,
      contract_id: searchForm.contract_id,
      file_type: searchForm.file_type,
      min_score: searchForm.min_score,
      include_content: searchForm.include_content
    });
    return response.data;
  }

  async getDocumentStats(): Promise<DocumentStats> {
    const response = await api.get<DocumentStats>('/documents/stats');
    return response.data;
  }

  async getFileTypes(): Promise<FileTypesResponse> {
    const response = await api.get<FileTypesResponse>('/documents/file-types');
    return response.data;
  }

  // File operations
  async downloadAllDocuments(options?: {
    limit?: number;
    download_folder?: string;
    concurrency?: number;
    contract_id?: string;
  }): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/download-all', options || {});
    return response.data;
  }

  async getDownloadStatus(): Promise<ApiResponse> {
    const response = await api.get<ApiResponse>('/documents/download/status');
    return response.data;
  }

  async fetchContractsFromDocuments(options: {
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/fetch-contracts', options);
    return response.data;
  }
}

export const documentsApi = new DocumentsApiService();
