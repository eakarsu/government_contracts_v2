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
  query: string;
  results: {
    contracts: Contract[];
    total_results: number;
  };
  response_time: number;
  ai_analysis?: {
    summary: string;
    key_points: string[];
    recommendations: string[];
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
