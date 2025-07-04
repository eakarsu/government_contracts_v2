import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import LoadingSpinner from '../UI/LoadingSpinner';

const QuickActions: React.FC = () => {
  const queryClient = useQueryClient();

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
    mutationFn: () => apiService.processDocuments(undefined, 50),
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
    mutationFn: () => apiService.processQueuedDocuments(),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
    onError: (error: any) => {
      console.error('Download documents error:', error);
    },
  });

  const resetQueueMutation = useMutation({
    mutationFn: () => apiService.resetQueue(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
    onError: (error: any) => {
      console.error('Reset queue error:', error);
    },
  });

  const clearAndRepopulateQueueMutation = useMutation({
    mutationFn: async () => {
      // First clear the queue
      await apiService.resetQueue();
      // Then repopulate with filtered documents
      return apiService.queueDocuments();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
    onError: (error: any) => {
      console.error('Clear and repopulate queue error:', error);
    },
  });

  const stopQueueMutation = useMutation({
    mutationFn: () => apiService.stopQueue(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
    onError: (error: any) => {
      console.error('Stop queue error:', error);
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
          onClick={() => clearAndRepopulateQueueMutation.mutate()}
          disabled={clearAndRepopulateQueueMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
        >
          {clearAndRepopulateQueueMutation.isPending ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            'Clear & Queue Valid Docs Only'
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
            'Process Queue'
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

        {/* Queue Management Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Queue Management</h4>
          <div className="space-y-2">
            <button
              onClick={() => stopQueueMutation.mutate()}
              disabled={stopQueueMutation.isPending}
              className="w-full flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 transition-colors"
            >
              {stopQueueMutation.isPending ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                'Stop Processing'
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
                'Reset Queue System'
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

      {clearAndRepopulateQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Queue cleared and repopulated with valid documents only!</div>
        </div>
      ) : null}

      {processQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Queue processing started!</div>
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

      {clearAndRepopulateQueueMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error clearing and repopulating queue: {clearAndRepopulateQueueMutation.error instanceof Error ? clearAndRepopulateQueueMutation.error.message : 'Unknown error'}
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

      {stopQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="text-yellow-800 text-sm">Queue processing stopped!</div>
        </div>
      ) : null}

      {resetQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">Queue system reset successfully!</div>
        </div>
      ) : null}

      {stopQueueMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error stopping queue: {stopQueueMutation.error instanceof Error ? stopQueueMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {resetQueueMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error resetting queue: {resetQueueMutation.error instanceof Error ? resetQueueMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default QuickActions;
