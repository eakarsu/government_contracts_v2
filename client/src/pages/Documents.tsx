import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { QueueStatus, ApiResponse, DocumentSearchForm, DocumentSearchResponse, DocumentStats, FileTypesResponse } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import DocumentDownload from '../components/Dashboard/DocumentDownload';

const Documents: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [model, setModel] = useState('');
  const [activeTab, setActiveTab] = useState<'download' | 'search' | 'upload' | 'queue'>('download');
  
  // Search state
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
  
  const queryClient = useQueryClient();

  const { data: queueStatus, isLoading: queueLoading } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => apiService.getQueueStatus(),
    refetchInterval: 5000,
  });

  // Document stats query
  const { data: documentStats, isLoading: statsLoading } = useQuery({
    queryKey: ['documentStats'],
    queryFn: () => apiService.getDocumentStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // File types query
  const { data: fileTypes } = useQuery({
    queryKey: ['fileTypes'],
    queryFn: () => apiService.getFileTypes(),
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { files: FileList; customPrompt?: string; model?: string }) =>
      apiService.uploadMultipleDocuments(data.files, data.customPrompt, data.model),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
      setSelectedFiles(null);
      setCustomPrompt('');
      setModel('');
    },
  });

  const processQueueMutation = useMutation({
    mutationFn: () => apiService.processQueueAsync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
  });

  const queueDocumentsMutation = useMutation({
    mutationFn: () => apiService.queueDocuments(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
  });

  const downloadQueuedMutation = useMutation({
    mutationFn: (options: { limit?: number; download_folder?: string }) => 
      apiService.downloadAllDocuments(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate({ files: selectedFiles, customPrompt, model });
    }
  };

  const handleProcessQueue = () => {
    processQueueMutation.mutate();
  };

  const handleQueueDocuments = () => {
    queueDocumentsMutation.mutate();
  };

  const handleDownloadQueued = () => {
    downloadQueuedMutation.mutate({
      limit: 100,
      download_folder: 'downloaded_documents'
    });
  };

  // Search functionality
  const handleSearch = async () => {
    if (!searchForm.query.trim()) {
      return;
    }

    setIsSearching(true);
    try {
      const results = await apiService.searchDocuments(searchForm);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchFormChange = (field: keyof DocumentSearchForm, value: any) => {
    setSearchForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearSearch = () => {
    setSearchResults(null);
    setSearchForm(prev => ({
      ...prev,
      query: ''
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
        <p className="mt-2 text-gray-600">
          Download, upload, and process documents with AI analysis
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('download')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'download'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📥 Download Documents
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🔍 Search Documents
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📤 Upload Documents
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'queue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ⚙️ Processing Queue
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'download' && (
        <DocumentDownload />
      )}

      {activeTab === 'search' && (
        <div className="space-y-8">
          {/* Document Statistics */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Document Statistics</h2>
            
            {statsLoading ? (
              <LoadingSpinner />
            ) : documentStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {documentStats.stats.documents.downloaded}
                  </div>
                  <div className="text-sm text-blue-600">Downloaded Files</div>
                  <div className="text-xs text-gray-500">
                    {documentStats.stats.documents.downloaded_size_mb} MB total
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {documentStats.stats.documents.indexed_in_vector_db}
                  </div>
                  <div className="text-sm text-green-600">Indexed & Searchable</div>
                  <div className="text-xs text-gray-500">
                    {documentStats.stats.documents.indexing_rate}% indexed
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {documentStats.stats.contracts.with_documents}
                  </div>
                  <div className="text-sm text-purple-600">Contracts with Docs</div>
                  <div className="text-xs text-gray-500">
                    {documentStats.stats.contracts.percentage_with_docs}% of total
                  </div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {Object.keys(documentStats.stats.vector_database.documents_by_file_type).length}
                  </div>
                  <div className="text-sm text-orange-600">File Types</div>
                  <div className="text-xs text-gray-500">
                    PDF, DOC, DOCX, etc.
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">Unable to load statistics</div>
            )}
          </div>

          {/* Search Interface */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🔍 Search Documents</h2>
            
            <div className="space-y-4">
              {/* Search Query */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Query
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={searchForm.query}
                    onChange={(e) => handleSearchFormChange('query', e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter search terms (e.g., 'software development', 'cybersecurity', 'data analysis')"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchForm.query.trim()}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {isSearching ? <LoadingSpinner size="sm" /> : 'Search'}
                  </button>
                  {searchResults && (
                    <button
                      onClick={clearSearch}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Search Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Results Limit
                  </label>
                  <select
                    value={searchForm.limit}
                    onChange={(e) => handleSearchFormChange('limit', parseInt(e.target.value))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value={10}>10 results</option>
                    <option value={20}>20 results</option>
                    <option value={50}>50 results</option>
                    <option value={100}>100 results</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Type
                  </label>
                  <select
                    value={searchForm.file_type}
                    onChange={(e) => handleSearchFormChange('file_type', e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value="">All Types</option>
                    {fileTypes?.file_types.available_for_search.map(type => (
                      <option key={type} value={type}>
                        .{type} ({fileTypes.file_types.indexed[type] || 0} files)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Relevance Score
                  </label>
                  <select
                    value={searchForm.min_score}
                    onChange={(e) => handleSearchFormChange('min_score', parseFloat(e.target.value))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value={0.1}>0.1 (Low)</option>
                    <option value={0.3}>0.3 (Medium)</option>
                    <option value={0.5}>0.5 (High)</option>
                    <option value={0.7}>0.7 (Very High)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content
                  </label>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="checkbox"
                      checked={searchForm.include_content}
                      onChange={(e) => handleSearchFormChange('include_content', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Include full content</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search Results */}
          {searchResults && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Search Results for "{searchResults.query}"
                </h3>
                <div className="text-sm text-gray-500">
                  {searchResults.results.total_results} results in {searchResults.response_time}ms
                </div>
              </div>

              {searchResults.results.documents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-2">No documents found matching your search.</div>
                  <div className="text-sm text-gray-400">
                    Try adjusting your search terms or filters.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.results.documents.map((doc, index) => (
                    <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{doc.filename}</h4>
                            {doc.isDownloaded && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                📁 Downloaded
                              </span>
                            )}
                            {doc.hasSummarization && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                📝 Summarized
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Contract: {doc.contractId} • 
                            Relevance: {(doc.score * 100).toFixed(1)}% • 
                            Processed: {new Date(doc.processedAt).toLocaleDateString()}
                            {doc.isDownloaded && doc.localFilePath && (
                              <span className="ml-2 text-blue-600">
                                • Local: {doc.localFilePath.split('/').pop()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {(doc.score * 100).toFixed(1)}% match
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                        {doc.preview}
                      </div>

                      {/* Summarization Section */}
                      {doc.hasSummarization && doc.summarization && (
                        <div className="mt-3 border-t pt-3">
                          <details className="mb-2">
                            <summary className="text-sm font-medium text-purple-600 cursor-pointer hover:text-purple-800 mb-2">
                              📝 View AI Summarization
                            </summary>
                            <div className="mt-2 space-y-3">
                              {doc.summarization.summary && (
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">Summary:</h5>
                                  <div className="text-sm text-gray-600 bg-purple-50 p-3 rounded">
                                    {doc.summarization.summary}
                                  </div>
                                </div>
                              )}
                              
                              {doc.summarization.keyPoints && doc.summarization.keyPoints.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">Key Points:</h5>
                                  <ul className="text-sm text-gray-600 bg-purple-50 p-3 rounded list-disc list-inside space-y-1">
                                    {doc.summarization.keyPoints.map((point, idx) => (
                                      <li key={idx}>{point}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {doc.summarization.analysis && (
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">Analysis:</h5>
                                  <div className="text-sm text-gray-600 bg-purple-50 p-3 rounded">
                                    {doc.summarization.analysis}
                                  </div>
                                </div>
                              )}

                              {doc.summarization.recommendations && doc.summarization.recommendations.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">Recommendations:</h5>
                                  <ul className="text-sm text-gray-600 bg-purple-50 p-3 rounded list-disc list-inside space-y-1">
                                    {doc.summarization.recommendations.map((rec, idx) => (
                                      <li key={idx}>{rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {(doc.summarization.wordCount || doc.summarization.pageCount) && (
                                <div className="text-xs text-gray-500 pt-2 border-t">
                                  Document Stats: 
                                  {doc.summarization.wordCount && ` ${doc.summarization.wordCount} words`}
                                  {doc.summarization.pageCount && ` • ${doc.summarization.pageCount} pages`}
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      )}
                      
                      {/* Full Content Section */}
                      {doc.hasFullContent && (
                        <details className="mt-2">
                          <summary className="text-sm text-primary-600 cursor-pointer hover:text-primary-800">
                            📄 View full document content
                          </summary>
                          <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded max-h-96 overflow-y-auto">
                            {searchForm.include_content ? doc.document : (
                              <div className="text-center py-4">
                                <p className="text-gray-500 mb-2">Enable "Include full content" to view complete document text</p>
                                <button
                                  onClick={() => {
                                    handleSearchFormChange('include_content', true);
                                    handleSearch();
                                  }}
                                  className="text-primary-600 hover:text-primary-800 text-sm underline"
                                >
                                  Enable and search again
                                </button>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Documents</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Files
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Prompt (Optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter custom analysis prompt..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model (Optional)
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., gpt-4"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!selectedFiles || uploadMutation.isPending}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {uploadMutation.isPending ? <LoadingSpinner size="sm" /> : 'Upload Files'}
            </button>
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Processing Queue</h2>
            <div className="flex space-x-2">
              <button
                onClick={handleQueueDocuments}
                disabled={queueDocumentsMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {queueDocumentsMutation.isPending ? <LoadingSpinner size="sm" /> : 'Queue Documents'}
              </button>
              <button
                onClick={handleDownloadQueued}
                disabled={downloadQueuedMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
              >
                {downloadQueuedMutation.isPending ? <LoadingSpinner size="sm" /> : 'Download to Folder'}
              </button>
              <button
                onClick={handleProcessQueue}
                disabled={processQueueMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {processQueueMutation.isPending ? <LoadingSpinner size="sm" /> : 'Process Queue'}
              </button>
            </div>
          </div>

          {queueLoading ? (
            <LoadingSpinner />
          ) : queueStatus?.queue_status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {queueStatus.queue_status.queued}
                  </div>
                  <div className="text-sm text-blue-600">Queued</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {queueStatus.queue_status.processing}
                  </div>
                  <div className="text-sm text-yellow-600">Processing</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {queueStatus.queue_status.completed}
                  </div>
                  <div className="text-sm text-green-600">Completed</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {queueStatus.queue_status.failed}
                  </div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        queueStatus.queue_status.total > 0
                          ? (queueStatus.queue_status.completed / queueStatus.queue_status.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="ml-3 text-sm text-gray-600">
                  {queueStatus.queue_status.completed} / {queueStatus.queue_status.total}
                </span>
              </div>

              {queueStatus.queue_status.is_processing && (
                <div className="flex items-center text-sm text-yellow-600">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Processing in progress...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No queue data available</div>
          )}

          {/* Success Messages */}
          {queueDocumentsMutation.isSuccess && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-blue-800 text-sm">
                Documents queued successfully!
              </div>
            </div>
          )}

          {downloadQueuedMutation.isSuccess && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
              <div className="text-purple-800 text-sm">
                Documents download started! Check the downloaded_documents folder.
              </div>
            </div>
          )}

          {processQueueMutation.isSuccess && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="text-green-800 text-sm">
                Queue processing started!
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Processing Queue</h2>
            <div className="flex space-x-2">
              <button
                onClick={handleQueueDocuments}
                disabled={queueDocumentsMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {queueDocumentsMutation.isPending ? <LoadingSpinner size="sm" /> : 'Queue Documents'}
              </button>
              <button
                onClick={handleDownloadQueued}
                disabled={downloadQueuedMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
              >
                {downloadQueuedMutation.isPending ? <LoadingSpinner size="sm" /> : 'Download to Folder'}
              </button>
              <button
                onClick={handleProcessQueue}
                disabled={processQueueMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {processQueueMutation.isPending ? <LoadingSpinner size="sm" /> : 'Process Queue'}
              </button>
            </div>
          </div>

          {queueLoading ? (
            <LoadingSpinner />
          ) : queueStatus?.queue_status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {queueStatus.queue_status.queued}
                  </div>
                  <div className="text-sm text-blue-600">Queued</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {queueStatus.queue_status.processing}
                  </div>
                  <div className="text-sm text-yellow-600">Processing</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {queueStatus.queue_status.completed}
                  </div>
                  <div className="text-sm text-green-600">Completed</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {queueStatus.queue_status.failed}
                  </div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        queueStatus.queue_status.total > 0
                          ? (queueStatus.queue_status.completed / queueStatus.queue_status.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="ml-3 text-sm text-gray-600">
                  {queueStatus.queue_status.completed} / {queueStatus.queue_status.total}
                </span>
              </div>

              {queueStatus.queue_status.is_processing && (
                <div className="flex items-center text-sm text-yellow-600">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Processing in progress...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No queue data available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Documents;
