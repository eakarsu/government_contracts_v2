import api from './api';
import type {
  ApiResponse,
  QueueStatus,
  DocumentSearchForm,
  DocumentSearchResponse,
  DocumentStats,
  FileTypesResponse,
} from '../types';

class DocumentProcessingApiService {
  // Document Processing
  async processDocuments(contractId?: string, limit: number = 50): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/documents/processing', { contract_id: contractId, limit }, {
        timeout: 3600000 // 1 hour timeout
      });
      return response.data;
    } catch (error: any) {
      // Handle non-JSON responses
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

  // Queue Management
  async queueDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue', {}, {
      timeout: 3600000 // 1 hour timeout
    });
    return response.data;
  }

  async getQueueStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    try {
      const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/parallel/status');
      return response.data;
    } catch (error) {
      const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/documents/queue/status');
      return response.data;
    }
  }

  async processQueuedDocuments(options?: { test_limit?: number }): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process', {
      concurrency: 3,      // Limited concurrency for testing
      batch_size: 3,       // Small batch size for testing
      process_all: false,  // Don't process all documents
      test_limit: options?.test_limit || 3  // Limit to 3 documents for testing
    }, {
      timeout: 3600000 // 1 hour timeout
    });
    return response.data;
  }

  async processQueueAsync(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process');
    return response.data;
  }

  async processQueueParallel(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process-parallel');
    return response.data;
  }

  async queueTestDocuments(options?: { test_limit?: number; clear_existing?: boolean }): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/test', options || { test_limit: 10, clear_existing: true });
    return response.data;
  }

  async processTestDocuments(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process-test');
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

  // This method is replaced by the newer one below

  async startQueue(): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/parallel/start');
      return response.data;
    } catch (error) {
      const response = await api.post<ApiResponse>('/documents/queue/start');
      return response.data;
    }
  }

  async resetQueue(): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/parallel/reset');
      return response.data;
    } catch (error) {
      const response = await api.post<ApiResponse>('/documents/queue/reset');
      return response.data;
    }
  }

  async stopQueue(): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/parallel/stop');
      return response.data;
    } catch (error) {
      const response = await api.post<ApiResponse>('/documents/queue/stop');
      return response.data;
    }
  }

  async startParallelProcessing(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/parallel/start');
    return response.data;
  }

  async stopParallelProcessing(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/parallel/stop');
    return response.data;
  }

  async resetParallelCounters(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/parallel/reset');
    return response.data;
  }

  async getParallelStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/parallel/status');
    return response.data;
  }

  async getParallelStats(): Promise<ApiResponse> {
    const response = await api.get<ApiResponse>('/parallel/stats');
    return response.data;
  }

  async resetAllToProcessing(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/reset-to-processing');
    return response.data;
  }

  // Document Download
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

export const documentProcessingApi = new DocumentProcessingApiService();
export default documentProcessingApi;