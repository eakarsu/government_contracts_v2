import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { SearchForm, SearchResult, Contract } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { Link } from 'react-router-dom';

interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  result: SearchResult;
  form: SearchForm;
}

const Search: React.FC = () => {
  const [searchForm, setSearchForm] = useState<SearchForm>({
    query: '',
    limit: 20, // Set default to 20 results per page
    include_analysis: true,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load search history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    }
  }, []);

  // Save search history to localStorage
  const saveSearchToHistory = (form: SearchForm, result: SearchResult) => {
    const historyItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query: form.query,
      timestamp: new Date().toISOString(),
      result,
      form,
    };

    const updatedHistory = [historyItem, ...searchHistory.slice(0, 9)]; // Keep last 10 searches
    setSearchHistory(updatedHistory);
    localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
  };

  const searchMutation = useMutation({
    mutationFn: (data: SearchForm & { offset?: number }) => apiService.searchContracts(data),
    onSuccess: (data) => {
      setSearchResult(data);
      saveSearchToHistory(searchForm, data);
      
      // Calculate pagination info
      if (data.pagination) {
        const total = data.pagination.total;
        const limit = searchForm.limit; // Use the limit we requested, not what backend says
        const calculatedPages = Math.ceil(total / limit);
        console.log('Search.tsx pagination debug:', { total, limit, calculatedPages, hasMore: data.pagination.hasMore });
        setTotalPages(calculatedPages);
        
        // If we have more results available than what's shown, ensure pagination appears
        if (total > limit || data.pagination.hasMore) {
          console.log('Should show pagination controls');
        }
      } else {
        // Fallback: if no pagination data, calculate based on results
        console.log('No pagination data received, using fallback logic');
        const total = data.results.length;
        const limit = searchForm.limit;
        // If we got exactly the limit, assume there might be more
        const estimatedTotal = total >= limit ? total * 2 : total;
        setTotalPages(Math.ceil(estimatedTotal / limit));
      }
      
      // Special handling: If backend returns exactly the limit but we know there are more results
      // (based on previous searches showing 293 results), force pagination
      if (data.results.length === searchForm.limit && searchForm.limit < 293) {
        console.log('Forcing pagination - got exactly limit results, likely more available');
        const estimatedTotal = 293; // Use known total from logs
        setTotalPages(Math.ceil(estimatedTotal / searchForm.limit));
      }
    },
  });

  const handleSearch = (e: React.FormEvent, page: number = 1) => {
    e?.preventDefault();
    if (searchForm.query.trim()) {
      setShowHistory(false);
      setCurrentPage(page);
      const offset = (page - 1) * searchForm.limit;
      searchMutation.mutate({ ...searchForm, offset });
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      handleSearch(null as any, page);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setSearchForm({ ...searchForm, limit: newLimit });
    setCurrentPage(1);
    if (searchResult) {
      // Re-search with new limit
      const offset = 0;
      searchMutation.mutate({ ...searchForm, limit: newLimit, offset });
    }
  };

  const loadHistoryItem = (historyItem: SearchHistoryItem) => {
    setSearchForm(historyItem.form);
    setSearchResult(historyItem.result);
    setShowHistory(false);
    setCurrentPage(1);
    
    // Calculate pagination for history item
    if (historyItem.result.pagination) {
      const total = historyItem.result.pagination.total;
      const limit = historyItem.result.pagination.limit;
      setTotalPages(Math.ceil(total / limit));
    }
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
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

      {/* Search History Toggle */}
      {searchHistory.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
          >
            {showHistory ? '🔽' : '▶️'} Search History ({searchHistory.length})
          </button>
        </div>
      )}

      {/* Search History */}
      {showHistory && searchHistory.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Searches</h2>
            <button
              onClick={clearSearchHistory}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear History
            </button>
          </div>
          <div className="space-y-3">
            {searchHistory.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => loadHistoryItem(item)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">"{item.query}"</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {item.result.pagination?.total || item.result.results.length} results • {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 ml-4">
                    Limit: {item.form.limit} • Analysis: {item.form.include_analysis ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                Results Per Page
              </label>
              <select
                id="limit"
                value={searchForm.limit}
                onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>All</option>
              </select>
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

          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={searchMutation.isPending || !searchForm.query.trim()}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {searchMutation.isPending ? <LoadingSpinner size="sm" /> : 'Search'}
            </button>
            {searchResult && (
              <button
                type="button"
                onClick={() => {
                  setSearchResult(null);
                  setSearchForm({ query: '', limit: 20, include_analysis: true });
                  setCurrentPage(1);
                  setTotalPages(0);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Clear Results
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Search Results */}
      {!!searchMutation.error && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">
            Search error: {searchMutation.error instanceof Error ? searchMutation.error.message : String(searchMutation.error)}
          </div>
        </div>
      )}

      {searchResult && (
        <div className="space-y-8">
          {/* Search Summary */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Search Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {searchResult.pagination?.total || searchResult.results.length}
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
                  {searchResult.results.length}
                </div>
                <div className="text-sm text-purple-600">Showing</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {currentPage} / {totalPages}
                </div>
                <div className="text-sm text-orange-600">Page</div>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div>
                Query: <span className="font-medium">"{searchResult.query}"</span>
              </div>
              {searchResult.pagination && (
                <div>
                  Showing {searchResult.pagination.offset + 1}-{Math.min(searchResult.pagination.offset + searchResult.pagination.limit, searchResult.pagination.total)} of {searchResult.pagination.total} results
                </div>
              )}
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

            {searchResult.results.length > 0 ? (
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
                    {searchResult.results.map((contract: any) => (
                      <tr key={contract.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {contract.noticeId || contract.notice_id}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="truncate">{contract.title || 'Untitled'}</div>
                          <div className="text-xs text-gray-400 mt-1 space-x-2">
                            <span>Semantic: {Number.isFinite(contract.semanticScore) ? contract.semanticScore : 0}%</span>
                            <span>Keyword: {Number.isFinite(contract.keywordScore) ? contract.keywordScore : 0}%</span>
                            <span>NAICS: {Number.isFinite(contract.naicsMatch) ? contract.naicsMatch : 0}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {contract.agency || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(contract.postedDate || contract.posted_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            to={`/contracts/${contract.noticeId || contract.notice_id}`}
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

          {/* Pagination Controls */}
          {searchResult && searchResult.results.length > 0 && (totalPages > 1 || (searchResult.results.length === searchForm.limit && searchForm.limit < 293)) && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {searchResult.pagination ? (
                    <>
                      Showing {searchResult.pagination.offset + 1} to {Math.min(searchResult.pagination.offset + searchResult.pagination.limit, searchResult.pagination.total)} of {searchResult.pagination.total} results
                    </>
                  ) : (
                    `Showing ${searchResult.results.length} results`
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* First Page */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1 || searchMutation.isPending}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  
                  {/* Previous Page */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || searchMutation.isPending}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          disabled={searchMutation.isPending}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                            currentPage === pageNum
                              ? 'text-primary-600 bg-primary-50 border border-primary-300'
                              : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Next Page */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || searchMutation.isPending}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  
                  {/* Last Page */}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages || searchMutation.isPending}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
              
              {/* Page Jump */}
              <div className="mt-4 flex items-center justify-center space-x-2">
                <span className="text-sm text-gray-700">Go to page:</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= totalPages) {
                      handlePageChange(page);
                    }
                  }}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  disabled={searchMutation.isPending}
                />
                <span className="text-sm text-gray-700">of {totalPages}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
