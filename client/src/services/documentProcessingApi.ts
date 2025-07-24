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
    console.log('🔄 [DEBUG] API Service: Calling queueDocuments endpoint...');
    const response = await api.post<ApiResponse>('/documents/queue', {}, {
      timeout: 3600000 // 1 hour timeout
    });
    console.log('🔄 [DEBUG] API Service: queueDocuments response:', response.data);
    return response.data;
  }

  async getQueueStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    //console.log('📊 [DEBUG] API Service: Calling getQueueStatus endpoint...');
    try {
      // First try the new parallel processing status endpoint
      const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/parallel/status');
      //console.log('📊 [DEBUG] API Service: getQueueStatus (parallel) response:', response.data);
      return response.data;
    } catch (error) {
      // Fallback to old queue status endpoint for compatibility
      console.log('📊 [DEBUG] Falling back to old queue status endpoint...');
      const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/documents/queue/status');
      //console.log('📊 [DEBUG] API Service: getQueueStatus (fallback) response:', response.data);
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
    const response = await api.post<ApiResponse>('/documents/queue/process-async');
    return response.data;
  }

  async processQueueParallel(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/process-parallel');
    return response.data;
  }

  async queueTestDocuments(options?: { test_limit?: number; clear_existing?: boolean }): Promise<ApiResponse> {
    console.log('🧪 [DEBUG] API Service: Calling queueTestDocuments endpoint...');
    const response = await api.post<ApiResponse>('/documents/queue/test', options || { test_limit: 10, clear_existing: true });
    console.log('🧪 [DEBUG] API Service: queueTestDocuments response:', response.data);
    return response.data;
  }

  async processTestDocuments(): Promise<ApiResponse> {
    console.log('🧪 [DEBUG] API Service: Calling processTestDocuments endpoint...');
    const response = await api.post<ApiResponse>('/documents/queue/process-test');
    console.log('🧪 [DEBUG] API Service: processTestDocuments response:', response.data);
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
      // First try the new parallel processing start endpoint
      const response = await api.post<ApiResponse>('/parallel/start');
      return response.data;
    } catch (error) {
      // Fallback to old queue start endpoint for compatibility
      console.log('📊 [DEBUG] Falling back to old queue start endpoint...');
      const response = await api.post<ApiResponse>('/documents/queue/start');
      return response.data;
    }
  }

  async resetQueue(): Promise<ApiResponse> {
    console.log('🔄 [DEBUG] API Service: Calling resetQueue endpoint...');
    try {
      // First try the new parallel processing reset endpoint
      const response = await api.post<ApiResponse>('/parallel/reset');
      console.log('🔄 [DEBUG] API Service: resetQueue (parallel) response:', response.data);
      return response.data;
    } catch (error) {
      // Fallback to old queue reset endpoint for compatibility
      console.log('📊 [DEBUG] Falling back to old queue reset endpoint...');
      const response = await api.post<ApiResponse>('/documents/queue/reset');
      console.log('🔄 [DEBUG] API Service: resetQueue (fallback) response:', response.data);
      return response.data;
    }
  }

  async stopQueue(): Promise<ApiResponse> {
    try {
      // First try the new parallel processing stop endpoint
      const response = await api.post<ApiResponse>('/parallel/stop');
      return response.data;
    } catch (error) {
      // Fallback to old queue stop endpoint for compatibility
      console.log('📊 [DEBUG] Falling back to old queue stop endpoint...');
      const response = await api.post<ApiResponse>('/documents/queue/stop');
      return response.data;
    }
  }

  // New parallel processing specific methods
  async startParallelProcessing(): Promise<ApiResponse> {
    console.log('🚀 [DEBUG] API Service: Starting parallel processing...');
    const response = await api.post<ApiResponse>('/parallel/start');
    console.log('🚀 [DEBUG] API Service: startParallelProcessing response:', response.data);
    return response.data;
  }

  async stopParallelProcessing(): Promise<ApiResponse> {
    console.log('⏹️ [DEBUG] API Service: Stopping parallel processing...');
    const response = await api.post<ApiResponse>('/parallel/stop');
    console.log('⏹️ [DEBUG] API Service: stopParallelProcessing response:', response.data);
    return response.data;
  }

  async resetParallelCounters(): Promise<ApiResponse> {
    console.log('🔄 [DEBUG] API Service: Resetting parallel processing counters...');
    const response = await api.post<ApiResponse>('/parallel/reset');
    console.log('🔄 [DEBUG] API Service: resetParallelCounters response:', response.data);
    return response.data;
  }

  async getParallelStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    console.log('📊 [DEBUG] API Service: Getting parallel processing status...');
    const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/parallel/status');
    console.log('📊 [DEBUG] API Service: getParallelStatus response:', response.data);
    return response.data;
  }

  async getParallelStats(): Promise<ApiResponse> {
    console.log('📊 [DEBUG] API Service: Getting parallel processing stats...');
    const response = await api.get<ApiResponse>('/parallel/stats');
    console.log('📊 [DEBUG] API Service: getParallelStats response:', response.data);
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
    console.log('🔄 [DEBUG] API Service fetchContractsFromDocuments called with:', options);
    console.log('🔄 [DEBUG] Making POST request to: /documents/fetch-contracts');
    console.log('🔄 [DEBUG] Full URL will be:', `${api.defaults.baseURL}/documents/fetch-contracts`);
    
    try {
      const response = await api.post<ApiResponse>('/documents/fetch-contracts', options);
      console.log('✅ [DEBUG] API Service fetchContractsFromDocuments response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [DEBUG] API Service fetchContractsFromDocuments error:', error);
      console.error('❌ [DEBUG] Error response:', error.response?.data);
      console.error('❌ [DEBUG] Error status:', error.response?.status);
      throw error;
    }
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

  // Document Search
  async searchDocuments(searchForm: DocumentSearchForm): Promise<DocumentSearchResponse> {
    console.log('🔍 [DEBUG] API Service searchDocuments called with:', searchForm);
    const response = await api.post<DocumentSearchResponse>('/documents/search/advanced', {
      query: searchForm.query,
      limit: searchForm.limit,
      contract_id: searchForm.contract_id,
      file_type: searchForm.file_type,
      min_score: searchForm.min_score,
      include_content: searchForm.include_content
    });
    console.log('🔍 [DEBUG] API Service searchDocuments response:', response.data);
    return response.data;
  }

  async getDocumentStats(): Promise<DocumentStats> {
    console.log('📊 [DEBUG] API Service getDocumentStats called');
    const response = await api.get<DocumentStats>('/documents/stats');
    console.log('📊 [DEBUG] API Service getDocumentStats response:', response.data);
    return response.data;
  }

  async getFileTypes(): Promise<FileTypesResponse> {
    console.log('📁 [DEBUG] API Service getFileTypes called');
    const response = await api.get<FileTypesResponse>('/documents/file-types');
    console.log('📁 [DEBUG] API Service getFileTypes response:', response.data);
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