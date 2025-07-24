import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import LoadingSpinner from '../UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const QuickActions: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [nlpQuery, setNlpQuery] = useState('');

  const fetchContractsMutation = useMutation({
    mutationFn: () => apiService.fetchContracts({ limit: 100, offset: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
  });

  const indexContractsMutation = useMutation({
    mutationFn: () => apiService.indexContracts(100),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
  });

  const processDocumentsMutation = useMutation({
    mutationFn: () => apiService.processDocuments(undefined, 50), // Use higher limit for full processing mode
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
    onError: (error: any) => {
      console.error('Process documents error:', error);
    },
  });

  const queueDocumentsMutation = useMutation({
    mutationFn: () => apiService.queueDocuments(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
  });

  const processQueueMutation = useMutation({
    mutationFn: () => apiService.startParallelProcessing(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
    onError: (error: any) => {
      console.error('Process queue error:', error);
    },
  });

  const downloadDocumentsMutation = useMutation({
    mutationFn: () => apiService.downloadAllDocuments({
      limit: 50,
      download_folder: 'downloaded_documents'
    }),
    onSuccess: async (response) => {
      // Invalidate queries to refresh the data from the server
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
    onError: (error: any) => {
      console.error('Download documents error:', error);
    },
  });

  const resetQueueMutation = useMutation({
    mutationFn: () => apiService.resetParallelCounters(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
    onError: (error: any) => {
      console.error('Reset parallel counters error:', error);
    },
  });

  const stopQueueMutation = useMutation({
    mutationFn: () => apiService.stopParallelProcessing(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
    onError: (error: any) => {
      console.error('Stop parallel processing error:', error);
    },
  });

  const startQueueMutation = useMutation({
    mutationFn: () => apiService.startParallelProcessing(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
    onError: (error: any) => {
      console.error('Start parallel processing error:', error);
    },
  });

  // Document search mutation
  const searchDocumentsMutation = useMutation({
    mutationFn: (query: string) => apiService.searchDocuments({
      query,
      limit: 10,
      min_score: 0.3,
      include_content: false
    }),
    onError: (error: any) => {
      console.error('Document search error:', error);
    },
  });

  // NLP Search mutations
  const nlpSearchMutation = useMutation({
    mutationFn: (query: string) => apiService.naturalLanguageSearch({
      query,
      includeSemantic: true,
      userContext: {}
    }),
    onSuccess: () => {
      navigate('/nlp-search');
    },
    onError: (error: any) => {
      console.error('NLP search error:', error);
    },
  });

  const getNLPSuggestionsMutation = useMutation({
    mutationFn: () => apiService.getNLPSuggestions(),
    onError: (error: any) => {
      console.error('NLP suggestions error:', error);
    },
  });

  // Get document stats mutation
  const getDocumentStatsMutation = useMutation({
    mutationFn: () => apiService.getDocumentStats(),
    onError: (error: any) => {
      console.error('Get document stats error:', error);
    },
  });

  // Test bed mutations for cost-effective testing
  const queueTestDocumentsMutation = useMutation({
    mutationFn: () => apiService.queueTestDocuments({ test_limit: 10, clear_existing: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
    onError: (error: any) => {
      console.error('Queue test documents error:', error);
    },
  });

  const processTestDocumentsMutation = useMutation({
    mutationFn: () => apiService.processTestDocuments(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
    onError: (error: any) => {
      console.error('Process test documents error:', error);
    },
  });

  return (
    <div className="bg-white shadow rounded-lg p-6 h-fit">
      <h3 className="text-lg font-medium text-gray-900 mb-6">Quick Actions</h3>
      <div className="space-y-4">
        <button
          onClick={() => fetchContractsMutation.mutate()}
          disabled={fetchContractsMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          {fetchContractsMutation.isPending ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            'Fetch Contracts'
          )}
        </button>

        <button
          onClick={() => indexContractsMutation.mutate()}
          disabled={indexContractsMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
        >
          {indexContractsMutation.isPending ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            'Index Contracts'
          )}
        </button>

        <button
          onClick={() => downloadDocumentsMutation.mutate()}
          disabled={downloadDocumentsMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
        >
          {downloadDocumentsMutation.isPending ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            'Download Documents'
          )}
        </button>


        <button
          onClick={() => processQueueMutation.mutate()}
          disabled={processQueueMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
        >
          {processQueueMutation.isPending ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            'Process Downloaded Documents'
          )}
        </button>

        <button
          onClick={() => processDocumentsMutation.mutate()}
          disabled={processDocumentsMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
        >
          {processDocumentsMutation.isPending ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            'Auto Queue & Process'
          )}
        </button>


        {/* Test Bed Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">🧪 Test Bed (Cost-Effective)</h4>
          <div className="space-y-2">
            <button
              onClick={() => queueTestDocumentsMutation.mutate()}
              disabled={queueTestDocumentsMutation.isPending}
              className="w-full flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
            >
              {queueTestDocumentsMutation.isPending ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                '🧪 Queue 10 Test Documents'
              )}
            </button>

            <button
              onClick={() => processTestDocumentsMutation.mutate()}
              disabled={processTestDocumentsMutation.isPending}
              className="w-full flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-colors"
            >
              {processTestDocumentsMutation.isPending ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                '🧪 Process Test Documents'
              )}
            </button>
          </div>
        </div>

        {/* Parallel Processing Management Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Parallel Processing Management</h4>
          <div className="space-y-2">
            <button
              onClick={() => startQueueMutation.mutate()}
              disabled={startQueueMutation.isPending}
              className="w-full flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
            >
              {startQueueMutation.isPending ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                'Start Parallel Processing'
              )}
            </button>

            <button
              onClick={() => stopQueueMutation.mutate()}
              disabled={stopQueueMutation.isPending}
              className="w-full flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 transition-colors"
            >
              {stopQueueMutation.isPending ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                'Stop Parallel Processing'
              )}
            </button>

            <button
              onClick={() => resetQueueMutation.mutate()}
              disabled={resetQueueMutation.isPending}
              className="w-full flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
              {resetQueueMutation.isPending ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                'Reset Counters'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Messages */}
      {fetchContractsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Contracts fetched successfully!</div>
        </div>
      ) : null}

      {indexContractsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Contracts indexed successfully!</div>
        </div>
      ) : null}


      {processQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Parallel processing started! Documents from downloaded_documents folder will be processed.</div>
        </div>
      ) : null}

      {downloadDocumentsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <div className="text-purple-800 text-sm">Documents download started! Check the downloaded_documents folder.</div>
        </div>
      ) : null}

      {processDocumentsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Auto queue & process started!</div>
        </div>
      ) : null}

      {/* Document Search Success Messages */}
      {searchDocumentsMutation.isSuccess && searchDocumentsMutation.data ? (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-blue-800 text-sm">
            🔍 Found {searchDocumentsMutation.data.results.total_results} documents in {searchDocumentsMutation.data.response_time}ms
          </div>
        </div>
      ) : null}

      {getDocumentStatsMutation.isSuccess && getDocumentStatsMutation.data ? (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <div className="text-purple-800 text-sm">
            📊 Stats: {getDocumentStatsMutation.data.stats.documents.downloaded} downloaded, {getDocumentStatsMutation.data.stats.documents.indexed_in_vector_db} indexed
          </div>
        </div>
      ) : null}

      {/* Test Bed Success Messages */}
      {queueTestDocumentsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
          <div className="text-orange-800 text-sm">🧪 Test documents queued successfully! (Minimal cost impact)</div>
        </div>
      ) : null}

      {processTestDocumentsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-md">
          <div className="text-teal-800 text-sm">🧪 Test document processing started! (Cost-effective mode)</div>
        </div>
      ) : null}

      {/* NLP Search Success Messages */}
      {nlpSearchMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <div className="text-purple-800 text-sm">✨ NLP search completed! Redirecting to results...</div>
        </div>
      ) : null}

      {/* Error Messages */}
      {fetchContractsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error fetching contracts: {fetchContractsMutation.error instanceof Error ? fetchContractsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {indexContractsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error indexing contracts: {indexContractsMutation.error instanceof Error ? indexContractsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}


      {processQueueMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error processing queue: {processQueueMutation.error instanceof Error ? processQueueMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {downloadDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error downloading documents: {downloadDocumentsMutation.error instanceof Error ? downloadDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {processDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error with auto process: {processDocumentsMutation.error instanceof Error ? processDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {/* Document Search Error Messages */}
      {searchDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            🔍 Search error: {searchDocumentsMutation.error instanceof Error ? searchDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {getDocumentStatsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            📊 Stats error: {getDocumentStatsMutation.error instanceof Error ? getDocumentStatsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {/* Test Bed Error Messages */}
      {queueTestDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            🧪 Error queueing test documents: {queueTestDocumentsMutation.error instanceof Error ? queueTestDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {processTestDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            🧪 Error processing test documents: {processTestDocumentsMutation.error instanceof Error ? processTestDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {startQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Parallel processing started successfully!</div>
        </div>
      ) : null}

      {stopQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="text-yellow-800 text-sm">Parallel processing stopped!</div>
        </div>
      ) : null}

      {resetQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">Parallel processing counters reset successfully!</div>
        </div>
      ) : null}

      {startQueueMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error starting parallel processing: {startQueueMutation.error instanceof Error ? startQueueMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {stopQueueMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error stopping parallel processing: {stopQueueMutation.error instanceof Error ? stopQueueMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {resetQueueMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error resetting parallel counters: {resetQueueMutation.error instanceof Error ? resetQueueMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {/* NLP Search Error Messages */}
      {nlpSearchMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            ✨ NLP search error: {nlpSearchMutation.error instanceof Error ? nlpSearchMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default QuickActions;
