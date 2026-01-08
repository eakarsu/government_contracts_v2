import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, RefreshCw, FileText, ExternalLink, Building2, Calendar } from 'lucide-react';
import { apiService } from '../services/api';
import { contractsApi } from '../services/contractsApi';
import { SearchForm, SearchResult } from '../types';

const Search: React.FC = () => {
  const [searchForm, setSearchForm] = useState<SearchForm>({
    query: '',
    limit: 20,
    include_analysis: true,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Fetch initial contracts on load
  const { data: initialContracts, isLoading: initialLoading } = useQuery({
    queryKey: ['initial-contracts', currentPage, searchForm.limit],
    queryFn: () => contractsApi.getContracts(currentPage, searchForm.limit),
    enabled: !isSearchMode,
  });

  const searchMutation = useMutation({
    mutationFn: (data: SearchForm & { offset?: number }) => apiService.searchContracts(data),
    onSuccess: (data) => {
      setSearchResult(data);
      setIsSearchMode(true);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchForm.query.trim()) {
      setCurrentPage(1);
      searchMutation.mutate({ ...searchForm, offset: 0 });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (isSearchMode) {
      const offset = (page - 1) * searchForm.limit;
      searchMutation.mutate({ ...searchForm, offset });
    }
  };

  const handleClearSearch = () => {
    setSearchForm({ ...searchForm, query: '' });
    setSearchResult(null);
    setIsSearchMode(false);
    setCurrentPage(1);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get display data based on mode
  const contracts = isSearchMode
    ? searchResult?.results || []
    : (initialContracts as any)?.contracts || [];

  const totalCount = isSearchMode
    ? searchResult?.pagination?.total || searchResult?.results.length || 0
    : (initialContracts as any)?.total || contracts.length;

  const totalPages = Math.ceil(totalCount / searchForm.limit);
  const isLoading = isSearchMode ? searchMutation.isPending : initialLoading;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Search Contracts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse and search government contracts
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contracts by keyword, agency, or NAICS code..."
              value={searchForm.query}
              onChange={(e) => setSearchForm({ ...searchForm, query: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={searchForm.limit}
            onChange={(e) => setSearchForm({ ...searchForm, limit: parseInt(e.target.value) })}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
          <button
            type="submit"
            disabled={searchMutation.isPending || !searchForm.query.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {searchMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <SearchIcon className="h-4 w-4" />
                Search
              </>
            )}
          </button>
          {isSearchMode && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Error */}
      {searchMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">Search failed. Please try again.</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Results */}
      {!isLoading && contracts.length > 0 && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {isSearchMode ? 'Found' : 'Showing'} <strong className="text-gray-900">{totalCount}</strong> contracts
              {searchResult?.response_time && ` in ${searchResult.response_time.toFixed(2)}s`}
            </span>
            <span>Page {currentPage} of {totalPages || 1}</span>
          </div>

          {/* Results List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="divide-y divide-gray-100">
              {contracts.map((contract: any, i: number) => (
                <Link
                  key={contract.id || contract.noticeId || i}
                  to={`/contracts/${contract.noticeId || contract.notice_id}`}
                  className="block px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">
                        {contract.title || 'Untitled Contract'}
                      </h3>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {contract.agency?.split('.')[0] || 'Unknown Agency'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(contract.postedDate || contract.posted_date)}
                        </span>
                        {contract.naicsCode && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                            NAICS: {contract.naicsCode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {contract.semanticScore > 0 && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          contract.semanticScore >= 80 ? 'bg-green-100 text-green-700' :
                          contract.semanticScore >= 50 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {contract.semanticScore}% match
                        </span>
                      )}
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
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
                      className={`w-10 h-10 text-sm rounded-lg ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && contracts.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-16 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isSearchMode ? 'No Results Found' : 'No Contracts Available'}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {isSearchMode
              ? `No contracts found for "${searchForm.query}". Try different keywords.`
              : 'No contracts in the database yet. Fetch contracts from SAM.gov to get started.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default Search;
