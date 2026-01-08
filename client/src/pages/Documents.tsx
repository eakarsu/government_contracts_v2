import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FolderOpen,
  Database,
  Sparkles,
  Brain,
  AlertCircle,
  ExternalLink,
  X,
  Eye
} from 'lucide-react';
import { apiService } from '../services/api';
import { DocumentSearchForm, DocumentSearchResponse } from '../types';
import DocumentDownload from '../components/Dashboard/DocumentDownload';

const Documents: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'download' | 'search' | 'upload' | 'queue'>('download');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [searchForm, setSearchForm] = useState<DocumentSearchForm>({
    query: '',
    limit: 20,
    contract_id: '',
    file_type: '',
    min_score: 0.1,
    include_content: false
  });
  const [searchResults, setSearchResults] = useState<DocumentSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessingActive, setIsProcessingActive] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);

  const queryClient = useQueryClient();

  // Use faster polling (2s) when processing is active, otherwise 5s
  const { data: queueStatus, isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => apiService.getQueueStatus(),
    refetchInterval: isProcessingActive ? 2000 : 5000,
  });

  // Update processing state based on queue status
  useEffect(() => {
    if (queueStatus?.queue_status) {
      const isActive = queueStatus.queue_status.is_processing || queueStatus.queue_status.processing > 0;
      setIsProcessingActive(isActive);
    }
  }, [queueStatus]);

  const { data: documentStats, isLoading: statsLoading } = useQuery({
    queryKey: ['documentStats'],
    queryFn: () => apiService.getDocumentStats(),
    refetchInterval: 30000,
  });

  const { data: fileTypes } = useQuery({
    queryKey: ['fileTypes'],
    queryFn: () => apiService.getFileTypes(),
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { files: FileList; customPrompt?: string }) =>
      apiService.uploadMultipleDocuments(data.files, data.customPrompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
      setSelectedFiles(null);
      setCustomPrompt('');
    },
  });

  const processQueueMutation = useMutation({
    mutationFn: () => apiService.processQueueAsync(),
    onSuccess: () => {
      setIsProcessingActive(true); // Start fast polling
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
  });

  const queueDocumentsMutation = useMutation({
    mutationFn: () => apiService.queueDocuments(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queueStatus'] }),
  });

  const handleRefreshQueue = () => {
    refetchQueue();
  };

  const handleSearch = async () => {
    if (!searchForm.query.trim()) return;
    setIsSearching(true);
    try {
      const results = await apiService.searchDocuments(searchForm);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const tabs = [
    { id: 'download', label: 'Download', icon: Download, description: 'Download files from SAM.gov' },
    { id: 'search', label: 'Search', icon: Search, description: 'Search downloaded documents' },
    { id: 'upload', label: 'Upload', icon: Upload, description: 'Upload local files' },
    { id: 'queue', label: 'AI Processing', icon: Sparkles, description: 'AI summarization (uses OpenRouter)' },
  ];

  const queue = queueStatus?.queue_status;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Document Management</h1>
        </div>
        <p className="text-sm text-gray-500">
          Download, upload, search, and process contract documents
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 -mb-px bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Download Tab */}
          {activeTab === 'download' && <DocumentDownload />}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              {/* Document Stats */}
              {documentStats && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Download className="h-4 w-4 text-blue-600" />
                      <span className="text-xs text-blue-600 font-medium">Downloaded</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">{documentStats.stats.documents.downloaded}</p>
                    <p className="text-xs text-blue-600">{documentStats.stats.documents.downloaded_size_mb} MB</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">Indexed</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">{documentStats.stats.documents.indexed_in_vector_db}</p>
                    <p className="text-xs text-green-600">{documentStats.stats.documents.indexing_rate}% rate</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-4 w-4 text-purple-600" />
                      <span className="text-xs text-purple-600 font-medium">With Docs</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-700">{documentStats.stats.contracts.with_documents}</p>
                    <p className="text-xs text-purple-600">{documentStats.stats.contracts.percentage_with_docs}% of contracts</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-orange-600" />
                      <span className="text-xs text-orange-600 font-medium">File Types</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-700">
                      {Object.keys(documentStats.stats.vector_database.documents_by_file_type).length}
                    </p>
                    <p className="text-xs text-orange-600">PDF, DOC, etc.</p>
                  </div>
                </div>
              )}

              {/* Search Form */}
              <div className="bg-gray-50 rounded-lg p-5">
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={searchForm.query}
                      onChange={(e) => setSearchForm({ ...searchForm, query: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchForm.query.trim()}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-4 gap-4">
                  <select
                    value={searchForm.limit}
                    onChange={(e) => setSearchForm({ ...searchForm, limit: parseInt(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value={10}>10 results</option>
                    <option value={20}>20 results</option>
                    <option value={50}>50 results</option>
                  </select>
                  <select
                    value={searchForm.file_type}
                    onChange={(e) => setSearchForm({ ...searchForm, file_type: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All file types</option>
                    {fileTypes?.file_types?.available_for_search?.map((type: string) => (
                      <option key={type} value={type}>.{type}</option>
                    ))}
                  </select>
                  <select
                    value={searchForm.min_score}
                    onChange={(e) => setSearchForm({ ...searchForm, min_score: parseFloat(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value={0.1}>Min score: 10%</option>
                    <option value={0.3}>Min score: 30%</option>
                    <option value={0.5}>Min score: 50%</option>
                    <option value={0.7}>Min score: 70%</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={searchForm.include_content}
                      onChange={(e) => setSearchForm({ ...searchForm, include_content: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    Include content
                  </label>
                </div>
              </div>

              {/* Search Results */}
              {searchResults && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">
                      Found <strong>{searchResults.results.total_results}</strong> documents in {searchResults.response_time}ms
                    </p>
                    <button
                      onClick={() => setSearchResults(null)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear results
                    </button>
                  </div>

                  <div className="space-y-3">
                    {searchResults.results.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
                        onClick={() => setSelectedDocument(doc)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-500" />
                            <div>
                              <h4 className="font-medium text-gray-900 hover:text-blue-600">{doc.filename}</h4>
                              <p className="text-xs text-gray-500">Contract: {doc.contractId}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            doc.score >= 0.7 ? 'bg-green-100 text-green-700' :
                            doc.score >= 0.4 ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {(doc.score * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{doc.preview}</p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {doc.isDownloaded && (
                              <span className="flex items-center gap-1 text-blue-600">
                                <Download className="h-3 w-3" /> Downloaded
                              </span>
                            )}
                            {doc.hasSummarization && (
                              <span className="flex items-center gap-1 text-purple-600">
                                <FileText className="h-3 w-3" /> Summarized
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-blue-600 flex items-center gap-1">
                            Click to view details <ExternalLink className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!searchResults && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Search for documents by keywords</p>
                </div>
              )}
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="max-w-xl">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Files</label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setSelectedFiles(e.target.files)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom Analysis Prompt (Optional)</label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter custom prompt for AI analysis..."
                  />
                </div>
                <button
                  onClick={() => selectedFiles && uploadMutation.mutate({ files: selectedFiles, customPrompt })}
                  disabled={!selectedFiles || uploadMutation.isPending}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploadMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="h-4 w-4" /> Upload Files</>
                  )}
                </button>
                {uploadMutation.isSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Files uploaded successfully!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Processing Tab */}
          {activeTab === 'queue' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-purple-900">AI Document Processing</h3>
                    <p className="text-sm text-purple-700 mt-1">
                      This section uses <strong>OpenRouter AI</strong> to analyze and summarize downloaded documents.
                      Documents are read by AI and summaries are stored for quick reference.
                    </p>
                    <p className="text-xs text-purple-600 mt-2">
                      For downloading files only (no AI), use the <strong>Download</strong> tab instead.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => queueDocumentsMutation.mutate()}
                  disabled={queueDocumentsMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {queueDocumentsMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                  Queue for AI Analysis
                </button>
                <button
                  onClick={() => processQueueMutation.mutate()}
                  disabled={processQueueMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {processQueueMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Run AI Summarization
                </button>
                <button
                  onClick={handleRefreshQueue}
                  disabled={queueLoading}
                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${queueLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Polling Status Indicator */}
              <div className="text-xs text-gray-500">
                Auto-refreshing every {isProcessingActive ? '2' : '5'} seconds
                {isProcessingActive && <span className="ml-2 text-purple-600 font-medium">(AI processing active)</span>}
              </div>

              {/* Queue Status */}
              {queueLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : queue ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">AI Summarization Status</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <Clock className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-700">{queue.queued}</p>
                      <p className="text-xs text-blue-600">Awaiting AI</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <Sparkles className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-700">{queue.processing}</p>
                      <p className="text-xs text-purple-600">AI Analyzing</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-700">{queue.completed}</p>
                      <p className="text-xs text-green-600">Summarized</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg text-center">
                      <XCircle className="h-5 w-5 text-red-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-red-700">{queue.failed}</p>
                      <p className="text-xs text-red-600">AI Failed</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${queue.total > 0 ? (queue.completed / queue.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{queue.completed}/{queue.total}</span>
                  </div>

                  {queue.is_processing && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Processing in progress...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No AI processing data available</p>
                </div>
              )}

              {/* Success Messages */}
              {queueDocumentsMutation.isSuccess && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Documents queued for AI analysis!
                  </p>
                </div>
              )}
              {processQueueMutation.isSuccess && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-700 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> AI summarization started! Watch the counters update.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document Detail Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedDocument(null)}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-auto transform transition-all">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedDocument.filename}</h3>
                    <p className="text-sm text-gray-500">Contract: {selectedDocument.contractId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {/* Match Score */}
                <div className="mb-4">
                  <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
                    selectedDocument.score >= 0.7 ? 'bg-green-100 text-green-700' :
                    selectedDocument.score >= 0.4 ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {(selectedDocument.score * 100).toFixed(0)}% match score
                  </span>
                </div>

                {/* Document Status */}
                <div className="flex items-center gap-4 mb-6">
                  {selectedDocument.isDownloaded && (
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
                      <Download className="h-4 w-4" /> Downloaded
                    </span>
                  )}
                  {selectedDocument.hasSummarization && (
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm">
                      <Sparkles className="h-4 w-4" /> AI Summarized
                    </span>
                  )}
                </div>

                {/* Preview Content */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Document Preview</h4>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedDocument.preview}</p>
                  </div>
                </div>

                {/* Full Content if available */}
                {selectedDocument.content && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Full Content</h4>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedDocument.content}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <button
                  onClick={() => navigate(`/contracts/${selectedDocument.contractId}`)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Contract
                </button>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
