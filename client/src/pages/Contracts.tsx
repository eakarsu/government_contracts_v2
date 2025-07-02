import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { Contract, ContractFetchForm } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const Contracts: React.FC = () => {
  const [page, setPage] = useState(1);
  const [fetchForm, setFetchForm] = useState<ContractFetchForm>({
    limit: 100,
    offset: 0,
  });
  const queryClient = useQueryClient();

  const { data: contractsData, isLoading, error } = useQuery({
    queryKey: ['contracts', page],
    queryFn: () => apiService.getContracts(page),
  });

  const fetchMutation = useMutation({
    mutationFn: (data: ContractFetchForm) => apiService.fetchContracts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  const indexMutation = useMutation({
    mutationFn: (limit: number) => apiService.indexContracts(limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  const handleFetch = () => {
    fetchMutation.mutate(fetchForm);
  };

  const handleIndex = () => {
    indexMutation.mutate(100);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const totalPages = contractsData?.total ? Math.ceil(contractsData.total / 20) : 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Contracts</h1>
        <p className="mt-2 text-gray-600">
          Manage and browse government contracts
        </p>
      </div>

      {/* Actions */}
      <div className="mb-6 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limit
              </label>
              <input
                type="number"
                value={fetchForm.limit}
                onChange={(e) => setFetchForm({ ...fetchForm, limit: parseInt(e.target.value) || 100 })}
                className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Offset
              </label>
              <input
                type="number"
                value={fetchForm.offset}
                onChange={(e) => setFetchForm({ ...fetchForm, offset: parseInt(e.target.value) || 0 })}
                className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleFetch}
                disabled={fetchMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {fetchMutation.isPending ? <LoadingSpinner size="sm" /> : 'Fetch Contracts'}
              </button>
            </div>
          </div>
          <button
            onClick={handleIndex}
            disabled={indexMutation.isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {indexMutation.isPending ? <LoadingSpinner size="sm" /> : 'Index Contracts'}
          </button>
        </div>

        {fetchMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="text-green-800 text-sm">
              Contracts fetched successfully!
            </div>
          </div>
        )}

        {indexMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="text-green-800 text-sm">
              Contracts indexed successfully!
            </div>
          </div>
        )}
      </div>

      {/* Contracts List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Contract List</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="px-6 py-12">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">
                Error loading contracts: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            </div>
          </div>
        ) : contractsData?.contracts && contractsData.contracts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notice ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Posted Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contractsData.contracts.map((contract: Contract) => (
                    <tr key={contract.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {contract.noticeId}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {contract.title || 'Untitled'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {contract.agency || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(contract.postedDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/contracts/${contract.noticeId}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing page {page} of {totalPages} ({contractsData.total} total contracts)
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="text-gray-500">No contracts found</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Contracts;
