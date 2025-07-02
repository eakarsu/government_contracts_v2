import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { Contract } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const ContractDetail: React.FC = () => {
  const { noticeId } = useParams<{ noticeId: string }>();
  const queryClient = useQueryClient();

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['contract', noticeId],
    queryFn: () => apiService.getContract(noticeId!),
    enabled: !!noticeId,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiService.analyzeContract(noticeId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', noticeId] });
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">
            Error loading contract: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Contract not found</h2>
          <p className="mt-2 text-gray-600">
            The contract with notice ID "{noticeId}" could not be found.
          </p>
          <Link
            to="/contracts"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Contracts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li>
              <Link to="/contracts" className="text-gray-400 hover:text-gray-500">
                Contracts
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg
                  className="flex-shrink-0 h-5 w-5 text-gray-300"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="ml-4 text-sm font-medium text-gray-500">
                  {contract.noticeId}
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {contract.title || 'Untitled Contract'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">Notice ID: {contract.noticeId}</p>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {analyzeMutation.isPending ? <LoadingSpinner size="sm" /> : 'Analyze Contract'}
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contract Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Agency</dt>
                  <dd className="text-sm text-gray-900">{contract.agency || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">NAICS Code</dt>
                  <dd className="text-sm text-gray-900">{contract.naicsCode || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Classification Code</dt>
                  <dd className="text-sm text-gray-900">{contract.classificationCode || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Posted Date</dt>
                  <dd className="text-sm text-gray-900">{formatDate(contract.postedDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Set Aside Code</dt>
                  <dd className="text-sm text-gray-900">{contract.setAsideCode || 'N/A'}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Description</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {contract.description || 'No description available.'}
              </div>
            </div>
          </div>

          {analyzeMutation.isSuccess && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="text-green-800">
                Contract analysis completed successfully!
              </div>
            </div>
          )}

          {!!analyzeMutation.error && (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-800">
                Error analyzing contract: {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : String(analyzeMutation.error)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractDetail;
