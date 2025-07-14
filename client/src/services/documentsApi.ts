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

  // Queue management
  async queueDocuments(): Promise<ApiResponse> {
    console.log('🔄 [DEBUG] Documents API: Calling queueDocuments endpoint...');
    const response = await api.post<ApiResponse>('/documents/queue', {}, {
      timeout: 3600000 // 1 hour timeout
    });
    console.log('🔄 [DEBUG] Documents API: queueDocuments response:', response.data);
    return response.data;
  }

  async getQueueStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    console.log('📊 [DEBUG] Documents API: Calling getQueueStatus endpoint...');
    const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/documents/queue/status');
    console.log('📊 [DEBUG] Documents API: getQueueStatus response:', response.data);
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
    console.log('🔄 [DEBUG] Documents API: Calling resetQueue endpoint...');
    const response = await api.post<ApiResponse>('/documents/queue/reset');
    console.log('🔄 [DEBUG] Documents API: resetQueue response:', response.data);
    return response.data;
  }

  // Document search
  async searchDocuments(searchForm: DocumentSearchForm): Promise<DocumentSearchResponse> {
    console.log('🔍 [DEBUG] Documents API searchDocuments called with:', searchForm);
    const response = await api.post<DocumentSearchResponse>('/documents/search/advanced', {
      query: searchForm.query,
      limit: searchForm.limit,
      contract_id: searchForm.contract_id,
      file_type: searchForm.file_type,
      min_score: searchForm.min_score,
      include_content: searchForm.include_content
    });
    console.log('🔍 [DEBUG] Documents API searchDocuments response:', response.data);
    return response.data;
  }

  async getDocumentStats(): Promise<DocumentStats> {
    console.log('📊 [DEBUG] Documents API getDocumentStats called');
    const response = await api.get<DocumentStats>('/documents/stats');
    console.log('📊 [DEBUG] Documents API getDocumentStats response:', response.data);
    return response.data;
  }

  async getFileTypes(): Promise<FileTypesResponse> {
    console.log('📁 [DEBUG] Documents API getFileTypes called');
    const response = await api.get<FileTypesResponse>('/documents/file-types');
    console.log('📁 [DEBUG] Documents API getFileTypes response:', response.data);
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
    console.log('🔄 [DEBUG] Documents API fetchContractsFromDocuments called with:', options);
    
    try {
      const response = await api.post<ApiResponse>('/documents/fetch-contracts', options);
      console.log('✅ [DEBUG] Documents API fetchContractsFromDocuments response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [DEBUG] Documents API fetchContractsFromDocuments error:', error);
      throw error;
    }
  }
}

export const documentsApi = new DocumentsApiService();
