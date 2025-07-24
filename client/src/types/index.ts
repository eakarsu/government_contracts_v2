// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Contract Types
export interface Contract {
  id: number;
  noticeId: string;
  title?: string;
  description?: string;
  agency?: string;
  naicsCode?: string;
  classificationCode?: string;
  postedDate?: string;
  setAsideCode?: string;
  resourceLinks?: string[];
  indexedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Search result specific fields
  semanticScore?: number;
  keywordScore?: number;
  naicsMatch?: number;
  relevanceScore?: number;
  documents?: {
    processing_queue: Array<{
      id: number;
      filename: string;
      status: string;
      document_url: string;
      local_file_path?: string;
      queued_at: string;
      started_at?: string;
      completed_at?: string;
      failed_at?: string;
      has_processed_data: boolean;
      processed_data_preview?: string;
      error_message?: string;
      is_local_file: boolean;
    }>;
    vector_database: Array<{
      id: string;
      filename: string;
      processed_at: string;
      relevance_score: number;
      content_preview: string;
      content_length: number;
    }>;
    downloaded_files: Array<{
      filename: string;
      size_bytes: number;
      size_mb: number;
      modified: string;
      extension: string;
      path: string;
    }>;
    resource_links_analysis: Array<{
      index: number;
      url: string;
      filename: string;
      extension: string;
      is_downloaded: boolean;
      queue_status: string;
      queue_entry_id?: number;
    }>;
  };
  statistics?: {
    total_resource_links: number;
    documents_in_queue: number;
    documents_in_vector_db: number;
    downloaded_files_count: number;
    completed_documents: number;
    failed_documents: number;
    processing_documents: number;
    queued_documents: number;
    download_completion_rate: number;
    processing_completion_rate: number;
  };
}

export interface ContractAnalysis {
  success: boolean;
  contract_id: string;
  analysis: {
    contract_overview: {
      title: string;
      agency: string;
      naics_code: string;
      classification: string;
      posted_date: string;
      set_aside: string;
      description_length: number;
      has_description: boolean;
    };
    document_analysis: {
      total_resource_links: number;
      documents_processed: number;
      documents_failed: number;
      documents_in_vector_db: number;
      processing_success_rate: number;
    };
    content_insights: {
      contract_text_length: number;
      has_sufficient_content: boolean;
      key_terms: Array<{
        term: string;
        frequency: number;
      }>;
      document_summaries: Array<{
        filename: string;
        summary: string;
        word_count: number;
        key_points: string[];
      }>;
    };
    recommendations: Array<{
      type: 'success' | 'warning' | 'info' | 'error';
      title: string;
      message: string;
    }>;
  };
  analyzed_at: string;
}

// Job Types
export interface IndexingJob {
  id: number;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_date?: string;
  end_date?: string;
  records_processed?: number;
  errors_count?: number;
  error_details?: string;
  created_at: string;
  completed_at?: string;
}

// Search Types
export interface SearchResult {
  success: boolean;
  query: string;
  results: Contract[];
  response_time: number;
  search_method: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  ai_analysis?: {
    summary: string;
    key_points: string[];
    recommendations: string[];
  };
}

export interface SearchResponse {
  success: boolean;
  query: string;
  results: Contract[];
  search_method: string;
  response_time: number;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  query_info?: {
    original_query: string;
    processed_query: string;
    search_type: string;
  };
}

// Document Types
export interface DocumentProcessingQueue {
  id: number;
  contractNoticeId: string;
  documentUrl: string;
  description?: string;
  localFilePath?: string;
  filename?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  processedData?: string;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  updatedAt: string;
}

export interface QueueStatus {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  is_processing: boolean;
  recent_documents?: {
    filename: string;
    completed_at: string;
    contract_notice_id: string;
  }[];
}

// API Status Types
export interface ApiStatus {
  status: 'healthy' | 'error';
  timestamp: string;
  database_stats: {
    contracts_in_db: number;
    contracts_indexed: number;
    documents_indexed: number;
    downloaded_files: number;
  };
  recent_jobs: IndexingJob[];
}

// Configuration Types
export interface AppConfig {
  apiBaseUrl: string;
  environment: string;
  maxFileSize: number;
  allowedExtensions: string[];
  features: {
    norshinApi: boolean;
    samGovApi: boolean;
    openRouterApi: boolean;
    vectorDatabase: boolean;
  };
  version: string;
}

// Form Types
export interface ContractFetchForm {
  start_date?: string;
  end_date?: string;
  limit: number;
  offset: number;
}

export interface SearchForm {
  query: string;
  limit: number;
  include_analysis: boolean;
}

export interface DocumentUploadForm {
  documents: FileList;
  customPrompt?: string;
  model?: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// Pagination Types
export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

// Filter Types
export interface ContractFilters {
  agency?: string;
  naicsCode?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  status?: string;
}

// Document Search Types
export interface DocumentSearchResult {
  id: string;
  score: number;
  metadata: {
    id: string;
    contractId: string;
    filename: string;
    processedAt: string;
    text?: string;
  };
  document: string;
  preview: string;
  filename: string;
  contractId: string;
  processedAt: string;
  isDownloaded: boolean;
  localFilePath?: string;
  summarization?: {
    summary?: string;
    analysis?: string;
    keyPoints?: string[];
    recommendations?: string[];
    wordCount?: number;
    pageCount?: number;
  };
  hasFullContent: boolean;
  hasSummarization: boolean;
}

export interface DocumentSearchResponse {
  success: boolean;
  query: string;
  results: {
    documents: DocumentSearchResult[];
    total_results: number;
    source: string;
  };
  filters?: {
    contract_id?: string;
    file_type?: string;
    min_score?: number;
    include_content?: boolean;
  };
  response_time: number;
  status?: string;
}

export interface DocumentSearchForm {
  query: string;
  limit: number;
  contract_id?: string;
  file_type?: string;
  min_score: number;
  include_content: boolean;
}

export interface DocumentStats {
  success: boolean;
  timestamp: string;
  stats: {
    contracts: {
      total: number;
      with_documents: number;
      percentage_with_docs: number;
    };
    documents: {
      downloaded: number;
      downloaded_size_mb: number;
      downloaded_by_type: Record<string, number>;
      indexed_in_vector_db: number;
      indexing_rate: number;
    };
    processing_queue: {
      queued: number;
      processing: number;
      completed: number;
      failed: number;
      total: number;
    };
    vector_database: {
      status: string;
      documents_by_contract: Array<{
        contractId: string;
        documentCount: number;
      }>;
      documents_by_file_type: Record<string, number>;
      recent_indexed: Array<{
        id: string;
        filename: string;
        contractId: string;
        processedAt: string;
        textLength: number;
      }>;
    };
    recent_jobs: Array<{
      id: number;
      type: string;
      status: string;
      processed: number;
      errors: number;
      started: string;
      completed?: string;
      duration_minutes?: number;
    }>;
  };
}

export interface FileTypesResponse {
  success: boolean;
  file_types: {
    indexed: Record<string, number>;
    downloaded: Record<string, number>;
    available_for_search: string[];
  };
}

// RFP System Types
export interface RFPTemplate {
  id: number;
  name: string;
  agency: string;
  description?: string;
  sections: RFPSection[];
  evaluationCriteria: EvaluationCriteria;
  createdAt: string;
  updatedAt: string;
}

export interface RFPSection {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  maxWords?: number;
  format?: 'narrative' | 'table' | 'spreadsheet' | 'list';
  mappings: string[];
  evaluationWeight?: number;
}

export interface EvaluationCriteria {
  technicalWeight: number;
  costWeight: number;
  pastPerformanceWeight: number;
  factors: EvaluationFactor[];
}

export interface EvaluationFactor {
  id: string;
  name: string;
  description: string;
  weight: number;
  type: 'technical' | 'cost' | 'past_performance' | 'management';
}

export interface CompanyProfile {
  id: number;
  companyName: string;
  basicInfo: {
    dunsNumber: string;
    cageCode: string;
    certifications: string[];
    sizeStandard: string;
    naicsCode: string[];
  };
  capabilities: {
    coreCompetencies: string[];
    technicalSkills: string[];
    securityClearances: string[];
    methodologies: string[];
  };
  pastPerformance: PastPerformanceRecord[];
  keyPersonnel: KeyPersonnel[];
  createdAt: string;
  updatedAt: string;
}

export interface PastPerformanceRecord {
  id: string;
  contractName: string;
  client: string;
  agency: string;
  contractValue: number;
  duration: string;
  performanceRating: 'exceptional' | 'very_good' | 'satisfactory' | 'marginal' | 'unsatisfactory';
  relevanceScore: number;
  description: string;
  keyAccomplishments: string[];
  contactInfo: {
    name: string;
    title: string;
    phone: string;
    email: string;
  };
}

export interface KeyPersonnel {
  id: string;
  name: string;
  role: string;
  clearanceLevel?: string;
  experienceYears: number;
  education: string[];
  certifications: string[];
  relevantProjects: string[];
  resume?: string;
}

export interface RFPResponse {
  id: number;
  contractId: string;
  templateId: number;
  companyProfileId: number;
  title: string;
  status: 'draft' | 'in_review' | 'approved' | 'submitted';
  responseData?: {
    sections: RFPResponseSection[];
    metadata: {
      generatedAt: string;
      lastModified?: string;
      wordCount?: number;
      pageCount?: number;
      customInstructions?: string;
      focusAreas?: string[];
    };
  };
  sections?: RFPResponseSection[]; // Legacy field for backward compatibility
  complianceStatus: ComplianceStatus;
  predictedScore: PredictedScore | number;
  metadata?: {
    generatedAt: string;
    lastModified: string;
    wordCount: number;
    pageCount: number;
    submissionDeadline?: string;
  };
  collaborators?: string[];
  versions?: RFPVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface RFPResponseSection {
  id: string;
  sectionId: string;
  title: string;
  content: string;
  wordCount: number;
  status: 'generated' | 'reviewed' | 'approved';
  compliance: SectionCompliance;
  lastModified: string;
  modifiedBy: string;
}

export interface ComplianceStatus {
  overall: boolean;
  score: number;
  checks: {
    wordLimits: ComplianceCheck;
    requiredSections: ComplianceCheck;
    formatCompliance: ComplianceCheck;
    requirementCoverage: ComplianceCheck;
  };
  issues: ComplianceIssue[];
}

export interface ComplianceCheck {
  passed: boolean;
  score: number;
  details: string;
}

export interface ComplianceIssue {
  type: 'error' | 'warning' | 'info';
  section: string;
  message: string;
  suggestion?: string;
}

export interface SectionCompliance {
  wordLimit: {
    current: number;
    maximum?: number;
    compliant: boolean;
  };
  requirementCoverage: {
    covered: string[];
    missing: string[];
    percentage: number;
  };
  quality: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
}

export interface PredictedScore {
  overall: number;
  technical: number;
  cost: number;
  pastPerformance: number;
  confidence: number;
  factors: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

export interface RFPVersion {
  id: number;
  versionNumber: number;
  changes: string[];
  createdBy: string;
  createdAt: string;
  comment?: string;
}

export interface RFPAnalysis {
  contractId: string;
  extractedData: {
    scopeOfWork: string;
    technicalRequirements: string[];
    deliverables: string[];
    timeline: string;
    evaluationCriteria: EvaluationCriteria;
    complianceRequirements: string[];
    submissionRequirements: {
      format: string;
      pageLimit?: number;
      deadline: string;
      sections: string[];
    };
  };
  recommendations: {
    templateSuggestion: string;
    keyFocusAreas: string[];
    competitiveAdvantages: string[];
    riskFactors: string[];
  };
  analyzedAt: string;
}

export interface RFPGenerationRequest {
  contractId: string;
  templateId: number;
  companyProfileId: number;
  customInstructions?: string;
  focusAreas?: string[];
  requestId?: string; // Added to prevent duplicate generations
}

export interface RFPGenerationResponse {
  success: boolean;
  rfpResponseId: number;
  generationTime: number;
  sectionsGenerated: number;
  complianceScore: number;
  predictedScore: number;
  message: string;
}

export interface CompetitiveAnalysis {
  marketInsights: {
    averageContractValue: number;
    commonRequirements: string[];
    winningStrategies: string[];
    pricingTrends: {
      low: number;
      average: number;
      high: number;
    };
  };
  positioning: {
    competitiveAdvantages: string[];
    differentiators: string[];
    riskFactors: string[];
    recommendations: string[];
  };
  pricingStrategy: {
    suggestedRange: {
      min: number;
      max: number;
    };
    justification: string;
    competitiveFactors: string[];
  };
}

export interface RFPDashboardStats {
  totalRFPs: number;
  activeRFPs: number;
  submittedRFPs: number;
  winRate: number;
  averageScore: number;
  recentActivity: {
    rfpId: number;
    title: string;
    status: string;
    lastModified: string;
  }[];
}

// Form Types for RFP System
export interface RFPTemplateForm {
  name: string;
  agency: string;
  description?: string;
  sections: Omit<RFPSection, 'id'>[];
  evaluationCriteria: EvaluationCriteria;
}

export interface CompanyProfileForm {
  companyName: string;
  basicInfo: CompanyProfile['basicInfo'];
  capabilities: CompanyProfile['capabilities'];
  pastPerformance: Omit<PastPerformanceRecord, 'id'>[];
  keyPersonnel: Omit<KeyPersonnel, 'id'>[];
}

export interface RFPSectionEditForm {
  content: string;
  customInstructions?: string;
  focusPoints?: string[];
}
