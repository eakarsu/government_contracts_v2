import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { SearchForm, SearchResult, Contract } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { Link } from 'react-router-dom';

const Search: React.FC = () => {
  const [searchForm, setSearchForm] = useState<SearchForm>({
    query: '',
    limit: 20,
    include_analysis: true,
  });
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  const searchMutation = useMutation({
    mutationFn: (data: SearchForm) => apiService.searchContracts(data),
    onSuccess: (data) => {
      setSearchResult(data);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchForm.query.trim()) {
      searchMutation.mutate(searchForm);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Search Contracts</h1>
        <p className="mt-2 text-gray-600">
          Search through government contracts with AI-powered analysis
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
              Search Query
            </label>
            <input
              type="text"
              id="query"
              value={searchForm.query}
              onChange={(e) => setSearchForm({ ...searchForm, query: e.target.value })}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter your search query..."
              required
            />
          </div>

          <div className="flex items-center space-x-4">
            <div>
              <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
                Results Limit
              </label>
              <input
                type="number"
                id="limit"
                value={searchForm.limit}
                onChange={(e) => setSearchForm({ ...searchForm, limit: parseInt(e.target.value) || 20 })}
                className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                min="1"
                max="100"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="include_analysis"
                checked={searchForm.include_analysis}
                onChange={(e) => setSearchForm({ ...searchForm, include_analysis: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="include_analysis" className="ml-2 block text-sm text-gray-900">
                Include AI Analysis
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={searchMutation.isPending || !searchForm.query.trim()}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {searchMutation.isPending ? <LoadingSpinner size="sm" /> : 'Search'}
          </button>
        </form>
      </div>

      {/* Search Results */}
      {searchMutation.error && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">
            Search error: {searchMutation.error instanceof Error ? searchMutation.error.message : 'Unknown error'}
          </div>
        </div>
      )}

      {searchResult && (
        <div className="space-y-8">
          {/* Search Summary */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Search Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {searchResult.results.total_results}
                </div>
                <div className="text-sm text-blue-600">Total Results</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {searchResult.response_time.toFixed(2)}s
                </div>
                <div className="text-sm text-green-600">Response Time</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {searchResult.results.contracts.length}
                </div>
                <div className="text-sm text-purple-600">Displayed</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Query: <span className="font-medium">"{searchResult.query}"</span>
            </div>
          </div>

          {/* AI Analysis */}
          {searchResult.ai_analysis && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Analysis</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                  <p className="text-sm text-gray-600">{searchResult.ai_analysis.summary}</p>
                </div>
                {searchResult.ai_analysis.key_points && searchResult.ai_analysis.key_points.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Key Points</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {searchResult.ai_analysis.key_points.map((point, index) => (
                        <li key={index} className="text-sm text-gray-600">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contract Results */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Contracts</h3>
            </div>

            {searchResult.results.contracts.length > 0 ? (
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
                    {searchResult.results.contracts.map((contract: Contract) => (
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
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="text-gray-500">No contracts found for your search query</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
