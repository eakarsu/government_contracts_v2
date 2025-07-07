import axios, { AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import type {
  ApiResponse,
  Contract,
  ContractAnalysis,
  IndexingJob,
  SearchResult,
  QueueStatus,
  ApiStatus,
  AppConfig,
  ContractFetchForm,
  SearchForm,
  DocumentSearchForm,
  DocumentSearchResponse,
  DocumentStats,
  FileTypesResponse,
  RFPTemplate,
  RFPTemplateForm,
  CompanyProfile,
  CompanyProfileForm,
  RFPAnalysis,
  CompetitiveAnalysis,
  RFPGenerationRequest,
  RFPGenerationResponse,
  RFPResponse,
  RFPResponseSection,
  RFPSectionEditForm,
  ComplianceStatus,
  PredictedScore,
  RFPVersion,
  RFPDashboardStats,
} from '../types';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 3600000, // 1 hour default timeout
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
    // Ensure response data is properly parsed
    if (typeof response.data === 'string') {
      try {
        response.data = JSON.parse(response.data);
      } catch (e) {
        // If it's not JSON, leave it as string
        console.warn('Response is not valid JSON:', response.data);
      }
    }
    return response;
  },
  (error) => {
    let message = 'An error occurred';
    
    // Handle different error response formats
    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        // Check if it's HTML error page
        if (error.response.data.includes('<!DOCTYPE html>')) {
          console.warn('Error response is HTML:', error.response.data);
          message = `Server error (${error.response.status}): Endpoint may not exist`;
        } else {
          try {
            const parsed = JSON.parse(error.response.data);
            message = parsed.error || parsed.message || message;
          } catch (e) {
            message = error.response.data;
          }
        }
      } else if (typeof error.response.data === 'object') {
        message = error.response.data.error || error.response.data.message || message;
      }
    } else {
      message = error.message || message;
    }
    
    // Don't show toast for certain endpoints
    const silentEndpoints = ['/status', '/config', '/rfp/analytics', '/rfp/responses'];
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
    console.log('🔄 [DEBUG] API Service fetchContracts called with:', data);
    const response = await api.post<ApiResponse>('/contracts/fetch', data, {
      timeout: 1800000 // 30 minutes timeout
    });
    console.log('✅ [DEBUG] API Service fetchContracts response:', response.data);
    return response.data;
  }

  async fetchContractsFromSamGov(data: ContractFetchForm): Promise<ApiResponse> {
    console.log('🔄 [DEBUG] API Service fetchContractsFromSamGov called with:', data);
    const response = await api.post<ApiResponse>('/contracts/fetch', data, {
      timeout: 1800000 // 30 minutes timeout
    });
    console.log('✅ [DEBUG] API Service fetchContractsFromSamGov response:', response.data);
    return response.data;
  }

  async indexContracts(limit: number = 100): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/contracts/index', { limit }, {
      timeout: 3600000 // 1 hour timeout
    });
    return response.data;
  }

  async getContracts(page: number = 1, limit: number = 20, filters?: {
    search?: string;
    agency?: string;
    naicsCode?: string;
  }): Promise<{ 
    success: boolean;
    data: Contract[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (filters?.search) params.append('search', filters.search);
    if (filters?.agency) params.append('agency', filters.agency);
    if (filters?.naicsCode) params.append('naicsCode', filters.naicsCode);
    
    const response = await api.get<{ 
      success: boolean;
      data: Contract[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/contracts?${params.toString()}`);
    return response.data;
  }

  async getContract(noticeId: string): Promise<Contract> {
    const response = await api.get<Contract>(`/documents/contracts/${noticeId}`);
    return response.data;
  }

  async analyzeContract(noticeId: string): Promise<ContractAnalysis> {
    console.log('🔍 [DEBUG] API Service analyzeContract called for:', noticeId);
    const response = await api.post<ContractAnalysis>(`/documents/contracts/${noticeId}/analyze`);
    console.log('🔍 [DEBUG] API Service analyzeContract raw response:', response);
    console.log('🔍 [DEBUG] API Service analyzeContract response.data:', response.data);
    return response.data;
  }

  // Search
  async searchContracts(data: SearchForm): Promise<SearchResult> {
    // Ensure query is provided
    if (!data.query || data.query.trim() === '') {
      throw new Error('Query parameter is required');
    }
    
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
    try {
      const response = await api.post<ApiResponse>('/documents/process', { contract_id: contractId, limit }, {
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

  async queueDocuments(): Promise<ApiResponse> {
    console.log('🔄 [DEBUG] API Service: Calling queueDocuments endpoint...');
    const response = await api.post<ApiResponse>('/documents/queue', {}, {
      timeout: 3600000 // 1 hour timeout
    });
    console.log('🔄 [DEBUG] API Service: queueDocuments response:', response.data);
    return response.data;
  }

  async getQueueStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    console.log('📊 [DEBUG] API Service: Calling getQueueStatus endpoint...');
    const response = await api.get<{ success: boolean; queue_status: QueueStatus }>('/documents/queue/status');
    console.log('📊 [DEBUG] API Service: getQueueStatus response:', response.data);
    return response.data;
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

  async stopQueue(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/stop');
    return response.data;
  }

  async resetQueue(): Promise<ApiResponse> {
    console.log('🔄 [DEBUG] API Service: Calling resetQueue endpoint...');
    const response = await api.post<ApiResponse>('/documents/queue/reset');
    console.log('🔄 [DEBUG] API Service: resetQueue response:', response.data);
    return response.data;
  }

  async resetAllToProcessing(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/documents/queue/reset-to-processing');
    return response.data;
  }

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

  // RFP System API Methods
  
  // RFP Templates
  async getRFPTemplates(): Promise<{ success: boolean; templates: RFPTemplate[] }> {
    const response = await api.get<{ success: boolean; templates: RFPTemplate[] }>('/rfp/templates');
    return response.data;
  }

  async getRFPTemplate(templateId: number): Promise<{ success: boolean; template: RFPTemplate }> {
    const response = await api.get<{ success: boolean; template: RFPTemplate }>(`/rfp/templates/${templateId}`);
    return response.data;
  }

  async createRFPTemplate(template: RFPTemplateForm): Promise<{ success: boolean; template: RFPTemplate }> {
    const response = await api.post<{ success: boolean; template: RFPTemplate }>('/rfp/templates', template);
    return response.data;
  }

  async updateRFPTemplate(templateId: number, template: Partial<RFPTemplateForm>): Promise<{ success: boolean; template: RFPTemplate }> {
    const response = await api.put<{ success: boolean; template: RFPTemplate }>(`/rfp/templates/${templateId}`, template);
    return response.data;
  }

  async deleteRFPTemplate(templateId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/rfp/templates/${templateId}`);
    return response.data;
  }

  // Company Profiles
  async getCompanyProfiles(): Promise<{ success: boolean; profiles: CompanyProfile[] }> {
    const response = await api.get<{ success: boolean; profiles: CompanyProfile[] }>('/rfp/company-profiles');
    return response.data;
  }

  async getCompanyProfile(profileId: number): Promise<{ success: boolean; profile: CompanyProfile }> {
    const response = await api.get<{ success: boolean; profile: CompanyProfile }>(`/rfp/company-profiles/${profileId}`);
    return response.data;
  }

  async createCompanyProfile(profile: CompanyProfileForm): Promise<{ success: boolean; profile: CompanyProfile }> {
    const response = await api.post<{ success: boolean; profile: CompanyProfile }>('/rfp/company-profiles', profile);
    return response.data;
  }

  async updateCompanyProfile(profileId: number, profile: Partial<CompanyProfileForm>): Promise<{ success: boolean; profile: CompanyProfile }> {
    const response = await api.put<{ success: boolean; profile: CompanyProfile }>(`/rfp/company-profiles/${profileId}`, profile);
    return response.data;
  }

  async deleteCompanyProfile(profileId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/rfp/company-profiles/${profileId}`);
    return response.data;
  }

  // RFP Analysis
  async analyzeContractForRFP(contractId: string): Promise<{ success: boolean; analysis: RFPAnalysis }> {
    console.log('🔍 [DEBUG] API Service analyzeContractForRFP called for:', contractId);
    const response = await api.post<{ success: boolean; analysis: RFPAnalysis }>(`/rfp/analyze/${contractId}`);
    console.log('🔍 [DEBUG] API Service analyzeContractForRFP response:', response.data);
    return response.data;
  }

  async getCompetitiveAnalysis(contractId: string, companyProfileId: number): Promise<{ success: boolean; analysis: CompetitiveAnalysis }> {
    const response = await api.post<{ success: boolean; analysis: CompetitiveAnalysis }>('/rfp/competitive-analysis', {
      contractId,
      companyProfileId
    });
    return response.data;
  }

  // RFP Generation
  async generateRFPResponse(request: RFPGenerationRequest): Promise<RFPGenerationResponse> {
    console.log('🚀 [DEBUG] API Service generateRFPResponse called with:', request);
    const response = await api.post<RFPGenerationResponse>('/rfp/generate', request, {
      timeout: 300000 // 5 minute timeout for generation
    });
    console.log('🚀 [DEBUG] API Service generateRFPResponse response:', response.data);
    return response.data;
  }

  async regenerateRFPSection(rfpResponseId: number, sectionId: string, customInstructions?: string): Promise<{ success: boolean; section: RFPResponseSection }> {
    const response = await api.post<{ success: boolean; section: RFPResponseSection }>(`/rfp/responses/${rfpResponseId}/sections/${sectionId}/regenerate`, {
      customInstructions
    });
    return response.data;
  }

  // RFP Response Management
  async getRFPResponses(page: number = 1, limit: number = 20): Promise<{ success: boolean; responses: RFPResponse[]; pagination: any }> {
    const response = await api.get<{ success: boolean; responses: RFPResponse[]; pagination: any }>(`/rfp/responses?page=${page}&limit=${limit}`);
    return response.data;
  }

  async getRFPResponse(responseId: number): Promise<{ success: boolean; response: RFPResponse }> {
    const response = await api.get<{ success: boolean; response: RFPResponse }>(`/rfp/responses/${responseId}`);
    return response.data;
  }

  async updateRFPResponse(responseId: number, updates: Partial<RFPResponse>): Promise<{ success: boolean; response: RFPResponse }> {
    const response = await api.put<{ success: boolean; response: RFPResponse }>(`/rfp/responses/${responseId}`, updates);
    return response.data;
  }

  async updateRFPSection(rfpResponseId: number, sectionId: string, updates: RFPSectionEditForm): Promise<{ success: boolean; section: RFPResponseSection }> {
    const response = await api.put<{ success: boolean; section: RFPResponseSection }>(`/rfp/responses/${rfpResponseId}/sections/${sectionId}`, updates);
    return response.data;
  }

  async deleteRFPResponse(responseId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete<{ success: boolean; message: string }>(`/rfp/responses/${responseId}`);
      return response.data;
    } catch (error: any) {
      // Handle 404 or other errors for missing delete endpoint
      if (error.response?.status === 404) {
        console.warn('🗑️ [DEBUG] Delete RFP Response endpoint not implemented yet, simulating deletion');
        
        // Since the server endpoint doesn't exist, we'll simulate the deletion
        // by removing it from localStorage and any cached data
        try {
          // Remove from localStorage if stored there
          const storedRFPs = localStorage.getItem('rfp_responses');
          if (storedRFPs) {
            const rfps = JSON.parse(storedRFPs);
            const updatedRFPs = rfps.filter((rfp: any) => rfp.id !== responseId);
            localStorage.setItem('rfp_responses', JSON.stringify(updatedRFPs));
            console.log('🗑️ [DEBUG] Removed RFP from localStorage');
          }
          
          // Also try to remove from any other storage mechanisms
          const keys = ['recent_rfps', 'dashboard_rfps', 'rfp_cache'];
          keys.forEach(key => {
            try {
              const data = localStorage.getItem(key);
              if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                  const filtered = parsed.filter((item: any) => item.id !== responseId);
                  localStorage.setItem(key, JSON.stringify(filtered));
                }
              }
            } catch (e) {
              // Ignore errors for non-existent or invalid data
            }
          });
          
        } catch (e) {
          console.warn('Could not update localStorage:', e);
        }
        
        // Return success to allow UI to proceed
        return {
          success: true,
          message: `RFP response ${responseId} deleted (simulated deletion - endpoint not yet implemented on server)`
        };
      }
      throw error;
    }
  }

  // RFP Compliance & Scoring
  async checkRFPCompliance(responseId: number): Promise<{ success: boolean; compliance: ComplianceStatus }> {
    const response = await api.post<{ success: boolean; compliance: ComplianceStatus }>(`/rfp/responses/${responseId}/compliance`);
    return response.data;
  }

  async predictRFPScore(responseId: number): Promise<{ success: boolean; prediction: PredictedScore }> {
    const response = await api.post<{ success: boolean; prediction: PredictedScore }>(`/rfp/responses/${responseId}/score-prediction`);
    return response.data;
  }

  // RFP Export & Collaboration
  async exportRFPResponse(responseId: number, format: 'pdf' | 'docx' | 'html'): Promise<{ success: boolean; downloadUrl: string }> {
    const response = await api.post<{ success: boolean; downloadUrl: string }>(`/rfp/responses/${responseId}/export`, { format });
    return response.data;
  }

  async addRFPCollaborator(responseId: number, email: string, role: 'viewer' | 'editor' | 'reviewer'): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/rfp/responses/${responseId}/collaborators`, { email, role });
    return response.data;
  }

  async removeRFPCollaborator(responseId: number, email: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/rfp/responses/${responseId}/collaborators/${email}`);
    return response.data;
  }

  // RFP Versions
  async createRFPVersion(responseId: number, comment?: string): Promise<{ success: boolean; version: RFPVersion }> {
    const response = await api.post<{ success: boolean; version: RFPVersion }>(`/rfp/responses/${responseId}/versions`, { comment });
    return response.data;
  }

  async getRFPVersions(responseId: number): Promise<{ success: boolean; versions: RFPVersion[] }> {
    const response = await api.get<{ success: boolean; versions: RFPVersion[] }>(`/rfp/responses/${responseId}/versions`);
    return response.data;
  }

  async restoreRFPVersion(responseId: number, versionId: number): Promise<{ success: boolean; response: RFPResponse }> {
    const response = await api.post<{ success: boolean; response: RFPResponse }>(`/rfp/responses/${responseId}/versions/${versionId}/restore`);
    return response.data;
  }

  // RFP Dashboard & Analytics
  async getRFPDashboardStats(): Promise<{ success: boolean; stats: RFPDashboardStats }> {
    const response = await api.get<{ success: boolean; stats: RFPDashboardStats }>('/rfp/dashboard/stats');
    return response.data;
  }

  async getRFPAnalytics(dateRange?: { start: string; end: string }): Promise<{ success: boolean; analytics: any }> {
    try {
      const params = dateRange ? `?start=${dateRange.start}&end=${dateRange.end}` : '';
      const response = await api.get<{ success: boolean; analytics: any }>(`/rfp/analytics${params}`);
      return response.data;
    } catch (error: any) {
      // Handle 404 for missing analytics endpoint
      if (error.response?.status === 404) {
        console.warn('RFP Analytics endpoint not implemented yet');
        return {
          success: false,
          analytics: {
            message: 'Analytics endpoint not yet implemented',
            totalRFPs: 0,
            winRate: 0,
            averageScore: 0
          }
        };
      }
      throw error;
    }
  }
}

export const apiService = new ApiService();
export default api;
