import axios, { AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import { contractsApi } from './contractsApi';
import { documentsApi } from './documentsApi';
import { documentProcessingApi } from './documentProcessingApi';
import { rfpApi } from './rfpApi';
import { nlpApi } from './nlpApi';
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
  baseURL: (window as any).API_CONFIG?.BASE_URL || '/api',
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

  // Contracts - delegate to contractsApi
  async fetchContracts(data: ContractFetchForm): Promise<ApiResponse> {
    return contractsApi.fetchContracts(data);
  }

  async fetchContractsFromSamGov(data: ContractFetchForm): Promise<ApiResponse> {
    return contractsApi.fetchContracts(data);
  }

  async indexContracts(limit: number = 100): Promise<ApiResponse> {
    return contractsApi.indexContracts(limit);
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
    return contractsApi.getContracts(page, limit, filters);
  }

  async getContract(noticeId: string): Promise<Contract> {
    return contractsApi.getContract(noticeId);
  }

  async analyzeContract(noticeId: string): Promise<ContractAnalysis> {
    return contractsApi.analyzeContract(noticeId);
  }

  // Search
  async searchContracts(data: SearchForm): Promise<SearchResult> {
    return contractsApi.searchContracts(data);
  }

  async getRecommendations(criteria: {
    naics_codes?: string[];
    agencies?: string[];
    keywords?: string[];
  }): Promise<ApiResponse> {
    return contractsApi.getRecommendations(criteria);
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

  // Document Processing - delegate to documentProcessingApi
  async processDocuments(contractId?: string, limit: number = 50): Promise<ApiResponse> {
    return documentProcessingApi.processDocuments(contractId, limit);
  }

  async processDocumentsNorshin(limit: number = 5): Promise<ApiResponse> {
    return documentProcessingApi.processDocumentsNorshin(limit);
  }

  async queueDocuments(): Promise<ApiResponse> {
    return documentProcessingApi.queueDocuments();
  }

  async getQueueStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    return documentProcessingApi.getQueueStatus();
  }

  async processQueuedDocuments(options?: { test_limit?: number }): Promise<ApiResponse> {
    return documentProcessingApi.processQueuedDocuments(options);
  }

  async processQueueAsync(): Promise<ApiResponse> {
    return documentProcessingApi.processQueueAsync();
  }

  async processQueueParallel(): Promise<ApiResponse> {
    return documentProcessingApi.processQueueParallel();
  }

  async queueTestDocuments(options?: { test_limit?: number; clear_existing?: boolean }): Promise<ApiResponse> {
    return documentProcessingApi.queueTestDocuments(options);
  }

  async processTestDocuments(): Promise<ApiResponse> {
    return documentProcessingApi.processTestDocuments();
  }

  async pauseQueue(): Promise<ApiResponse> {
    return documentProcessingApi.pauseQueue();
  }

  async resumeQueue(): Promise<ApiResponse> {
    return documentProcessingApi.resumeQueue();
  }

  async stopQueue(): Promise<ApiResponse> {
    return documentProcessingApi.stopQueue();
  }

  async startQueue(): Promise<ApiResponse> {
    return documentProcessingApi.startQueue();
  }

  async resetQueue(): Promise<ApiResponse> {
    return documentProcessingApi.resetQueue();
  }

  async resetAllToProcessing(): Promise<ApiResponse> {
    return documentProcessingApi.resetAllToProcessing();
  }

  async downloadAllDocuments(options?: {
    limit?: number;
    download_folder?: string;
    concurrency?: number;
    contract_id?: string;
  }): Promise<ApiResponse> {
    return documentProcessingApi.downloadAllDocuments(options);
  }

  async getDownloadStatus(): Promise<ApiResponse> {
    return documentProcessingApi.getDownloadStatus();
  }

  async fetchContractsFromDocuments(options: {
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse> {
    return documentProcessingApi.fetchContractsFromDocuments(options);
  }

  async retryFailedDocuments(): Promise<ApiResponse> {
    return documentProcessingApi.retryFailedDocuments();
  }

  async indexCompletedDocuments(): Promise<ApiResponse> {
    return documentProcessingApi.indexCompletedDocuments();
  }

  async getNotifications(): Promise<ApiResponse> {
    return documentProcessingApi.getNotifications();
  }

  async getProcessedDocuments(): Promise<ApiResponse> {
    return documentProcessingApi.getProcessedDocuments();
  }

  async searchDocuments(searchForm: DocumentSearchForm): Promise<DocumentSearchResponse> {
    return documentProcessingApi.searchDocuments(searchForm);
  }

  async getDocumentStats(): Promise<DocumentStats> {
    return documentProcessingApi.getDocumentStats();
  }

  async getFileTypes(): Promise<FileTypesResponse> {
    return documentProcessingApi.getFileTypes();
  }

  async uploadDocument(file: File, customPrompt?: string, model?: string): Promise<ApiResponse> {
    return documentProcessingApi.uploadDocument(file, customPrompt, model);
  }

  async uploadMultipleDocuments(files: FileList, customPrompt?: string, model?: string): Promise<ApiResponse> {
    return documentProcessingApi.uploadMultipleDocuments(files, customPrompt, model);
  }

  async getStaticDocuments(): Promise<{ documents: any[] }> {
    return documentProcessingApi.getStaticDocuments();
  }

  async processStaticDocument(filename: string, customPrompt?: string, model?: string): Promise<ApiResponse> {
    return documentProcessingApi.processStaticDocument(filename, customPrompt, model);
  }

  async getStuckDocuments(): Promise<ApiResponse> {
    return documentProcessingApi.getStuckDocuments();
  }

  async resetDocument(docId: number): Promise<ApiResponse> {
    return documentProcessingApi.resetDocument(docId);
  }

  async resetAllStuckDocuments(): Promise<ApiResponse> {
    return documentProcessingApi.resetAllStuckDocuments();
  }

  // Parallel Processing Methods
  async startParallelProcessing(): Promise<ApiResponse> {
    return documentProcessingApi.startParallelProcessing();
  }

  async stopParallelProcessing(): Promise<ApiResponse> {
    return documentProcessingApi.stopParallelProcessing();
  }

  async resetParallelCounters(): Promise<ApiResponse> {
    return documentProcessingApi.resetParallelCounters();
  }

  async getParallelStatus(): Promise<{ success: boolean; queue_status: QueueStatus }> {
    return documentProcessingApi.getParallelStatus();
  }

  async getParallelStats(): Promise<ApiResponse> {
    return documentProcessingApi.getParallelStats();
  }

  // RFP System - delegate to rfpApi
  async getRFPTemplates(): Promise<{ success: boolean; templates: RFPTemplate[] }> {
    return rfpApi.getRFPTemplates();
  }

  async getRFPTemplate(templateId: number): Promise<{ success: boolean; template: RFPTemplate }> {
    return rfpApi.getRFPTemplate(templateId);
  }

  async createRFPTemplate(template: RFPTemplateForm): Promise<{ success: boolean; template: RFPTemplate }> {
    return rfpApi.createRFPTemplate(template);
  }

  async updateRFPTemplate(templateId: number, template: Partial<RFPTemplateForm>): Promise<{ success: boolean; template: RFPTemplate }> {
    return rfpApi.updateRFPTemplate(templateId, template);
  }

  async deleteRFPTemplate(templateId: number): Promise<{ success: boolean; message: string }> {
    return rfpApi.deleteRFPTemplate(templateId);
  }

  async getCompanyProfiles(): Promise<{ success: boolean; profiles: CompanyProfile[] }> {
    return rfpApi.getCompanyProfiles();
  }

  async getCompanyProfile(profileId: number): Promise<{ success: boolean; profile: CompanyProfile }> {
    return rfpApi.getCompanyProfile(profileId);
  }

  async createCompanyProfile(profile: CompanyProfileForm): Promise<{ success: boolean; profile: CompanyProfile }> {
    return rfpApi.createCompanyProfile(profile);
  }

  async updateCompanyProfile(profileId: number, profile: Partial<CompanyProfileForm>): Promise<{ success: boolean; profile: CompanyProfile }> {
    return rfpApi.updateCompanyProfile(profileId, profile);
  }

  async deleteCompanyProfile(profileId: number): Promise<{ success: boolean; message: string }> {
    return rfpApi.deleteCompanyProfile(profileId);
  }

  async analyzeContractForRFP(contractId: string): Promise<{ success: boolean; analysis: RFPAnalysis }> {
    return rfpApi.analyzeContractForRFP(contractId);
  }

  async getCompetitiveAnalysis(contractId: string, companyProfileId: number): Promise<{ success: boolean; analysis: CompetitiveAnalysis }> {
    return rfpApi.getCompetitiveAnalysis(contractId, companyProfileId);
  }

  async generateRFPResponse(request: RFPGenerationRequest): Promise<RFPGenerationResponse> {
    return rfpApi.generateRFPResponse(request);
  }

  async regenerateRFPSection(rfpResponseId: number, sectionId: string, customInstructions?: string): Promise<{ success: boolean; section: RFPResponseSection }> {
    return rfpApi.regenerateRFPSection(rfpResponseId, sectionId, customInstructions);
  }

  async getRFPResponses(page: number = 1, limit: number = 20): Promise<{ success: boolean; responses: RFPResponse[]; pagination: any }> {
    return rfpApi.getRFPResponses(page, limit);
  }

  async getRFPResponse(responseId: number): Promise<{ success: boolean; response: RFPResponse }> {
    return rfpApi.getRFPResponse(responseId);
  }

  async updateRFPResponse(responseId: number, updates: Partial<RFPResponse>): Promise<{ success: boolean; response: RFPResponse }> {
    return rfpApi.updateRFPResponse(responseId, updates);
  }

  async updateRFPSection(rfpResponseId: number, sectionId: string, updates: RFPSectionEditForm): Promise<{ success: boolean; section: RFPResponseSection }> {
    return rfpApi.updateRFPSection(rfpResponseId, sectionId, updates);
  }

  async deleteRFPResponse(responseId: number): Promise<{ success: boolean; message: string }> {
    return rfpApi.deleteRFPResponse(responseId);
  }

  async checkRFPCompliance(responseId: number): Promise<{ success: boolean; compliance: ComplianceStatus }> {
    return rfpApi.checkRFPCompliance(responseId);
  }

  async predictRFPScore(responseId: number): Promise<{ success: boolean; prediction: PredictedScore }> {
    return rfpApi.predictRFPScore(responseId);
  }

  async exportRFPResponse(responseId: number, format: 'pdf' | 'docx' | 'html'): Promise<{ success: boolean; downloadUrl: string }> {
    return rfpApi.exportRFPResponse(responseId, format);
  }

  async addRFPCollaborator(responseId: number, email: string, role: 'viewer' | 'editor' | 'reviewer'): Promise<{ success: boolean; message: string }> {
    return rfpApi.addRFPCollaborator(responseId, email, role);
  }

  async removeRFPCollaborator(responseId: number, email: string): Promise<{ success: boolean; message: string }> {
    return rfpApi.removeRFPCollaborator(responseId, email);
  }

  async createRFPVersion(responseId: number, comment?: string): Promise<{ success: boolean; version: RFPVersion }> {
    return rfpApi.createRFPVersion(responseId, comment);
  }

  async getRFPVersions(responseId: number): Promise<{ success: boolean; versions: RFPVersion[] }> {
    return rfpApi.getRFPVersions(responseId);
  }

  async restoreRFPVersion(responseId: number, versionId: number): Promise<{ success: boolean; response: RFPResponse }> {
    return rfpApi.restoreRFPVersion(responseId, versionId);
  }

  async getRFPDashboardStats(): Promise<{ success: boolean; stats: RFPDashboardStats }> {
    return rfpApi.getRFPDashboardStats();
  }

  async getRFPAnalytics(dateRange?: { start: string; end: string }): Promise<{ success: boolean; analytics: any }> {
    return rfpApi.getRFPAnalytics(dateRange);
  }

  // NLP Search API Methods - delegate to nlpApi
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
    return nlpApi.naturalLanguageSearch(data);
  }

  async getNLPSuggestions(query?: string): Promise<{
    suggestions: string[];
  }> {
    return nlpApi.getNLPSuggestions(query);
  }

  async validateNLPQuery(query: string): Promise<{
    valid: boolean;
    parsed: any;
    issues: string[];
  }> {
    return nlpApi.validateNLPQuery(query);
  }

  async classifyIntent(query: string): Promise<{
    intent: string;
    confidence: number;
    sub_intent: string;
  }> {
    return nlpApi.classifyIntent(query);
  }

  async extractEntities(text: string): Promise<{
    entities: any;
    structured: any;
  }> {
    return nlpApi.extractEntities(text);
  }

  async getPersonalizedSuggestions(userContext?: any): Promise<{
    suggestions: any[];
  }> {
    return nlpApi.getPersonalizedSuggestions(userContext);
  }
}

export const apiService = new ApiService();
export default api;
