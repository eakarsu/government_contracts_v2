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
  });

  const queueDocumentsMutation = useMutation({
    mutationFn: () => apiService.queueDocuments(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
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
          onClick={() => processDocumentsMutation.mutate()}
          disabled={processDocumentsMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
        >
          {processDocumentsMutation.isPending ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            'Process Documents'
          )}
        </button>

        <button
          onClick={() => queueDocumentsMutation.mutate()}
          disabled={queueDocumentsMutation.isPending}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
        >
          {queueDocumentsMutation.isPending ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            'Queue Documents'
          )}
        </button>
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

      {processDocumentsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Documents processing started!</div>
        </div>
      ) : null}

      {queueDocumentsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Documents queued successfully!</div>
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

      {processDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error processing documents: {processDocumentsMutation.error instanceof Error ? processDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {queueDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error queueing documents: {queueDocumentsMutation.error instanceof Error ? queueDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default QuickActions;
