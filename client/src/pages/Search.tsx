import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search as SearchIcon,
  RefreshCw,
  FileText,
  Building2,
  Calendar,
  Paperclip,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Lightbulb
} from 'lucide-react';
import { apiService } from '../services/api';
import { contractsApi } from '../services/contractsApi';
import { SearchForm, SearchResult } from '../types';

type SearchMode = 'standard' | 'nlp';

interface NLPResult {
  id: string;
  noticeId: string;
  title: string;
  description: string;
  agency: string;
  naicsCode: string;
  postedDate: string;
  resourceLinks?: string[];
  scores?: {
    semantic: number;
    keyword: number;
    relevance: number;
    overall: number;
  };
}

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get URL parameters
  const urlPage = parseInt(searchParams.get('page') || '1');
  const urlQuery = searchParams.get('q') || '';
  const urlLimit = parseInt(searchParams.get('limit') || '20');
  const urlMode = (searchParams.get('mode') as SearchMode) || 'standard';

  // Try to restore cached results from sessionStorage
  const getCachedResults = (): SearchResult | null => {
    try {
      const cached = sessionStorage.getItem('searchCache');
      if (cached) {
        const { query: cachedQuery, result: cachedResult, mode: cachedMode } = JSON.parse(cached);
        if (cachedQuery === urlQuery && cachedResult?.results?.length > 0 && cachedMode === urlMode) {
          return cachedResult;
        }
      }
    } catch (e) {}
    return null;
  };

  const getCachedNLPResults = () => {
    try {
      const cached = sessionStorage.getItem('nlpSearchCache');
      if (cached) {
        const { query: cachedQuery, results: cachedResults, explanation: cachedExplanation } = JSON.parse(cached);
        if (cachedQuery === urlQuery && cachedResults?.length > 0) {
          return { results: cachedResults, explanation: cachedExplanation };
        }
      }
    } catch (e) {}
    return null;
  };

  const cachedData = getCachedResults();
  const cachedNLPData = getCachedNLPResults();

  const [searchMode, setSearchMode] = useState<SearchMode>(urlMode);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [searchForm, setSearchForm] = useState<SearchForm>({
    query: urlQuery,
    limit: urlLimit,
    include_analysis: true,
  });
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(cachedData);
  const [isSearchMode, setIsSearchMode] = useState(!!urlQuery || !!cachedData);

  // NLP Search state
  const [nlpResults, setNlpResults] = useState<NLPResult[]>(cachedNLPData?.results || []);
  const [nlpExplanation, setNlpExplanation] = useState(cachedNLPData?.explanation || '');
  const [isNlpSearching, setIsNlpSearching] = useState(false);

  // Example NLP queries
  const exampleQueries = [
    "IT contracts under $500K",
    "Construction projects in California",
    "Small business set-aside opportunities",
    "System upgrades and modernization",
    "Cybersecurity services",
    "Healthcare and medical supplies",
    "Environmental consulting",
    "Training and education services",
    "Software development contracts",
    "Facilities maintenance",
  ];

  // Update URL when page or search changes
  const updateUrl = (page: number, query: string, limit: number, mode: SearchMode) => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = page.toString();
    if (query) params.q = query;
    if (limit !== 20) params.limit = limit.toString();
    if (mode !== 'standard') params.mode = mode;
    setSearchParams(params, { replace: true });
  };

  // Cache results in sessionStorage
  const cacheResults = (searchQuery: string, result: SearchResult) => {
    try {
      sessionStorage.setItem('searchCache', JSON.stringify({
        query: searchQuery,
        result: result,
        mode: 'standard'
      }));
    } catch (e) {}
  };

  const cacheNLPResults = (searchQuery: string, results: NLPResult[], explanation: string) => {
    try {
      sessionStorage.setItem('nlpSearchCache', JSON.stringify({
        query: searchQuery,
        results: results,
        explanation: explanation
      }));
    } catch (e) {}
  };

  // Only run search if URL has query but no cached results
  useEffect(() => {
    if (urlQuery && urlMode === 'standard' && !searchResult?.results?.length) {
      setSearchForm(prev => ({ ...prev, query: urlQuery, limit: urlLimit }));
      setCurrentPage(urlPage);
      setIsSearchMode(true);
      const offset = (urlPage - 1) * urlLimit;
      searchMutation.mutate({ query: urlQuery, limit: urlLimit, include_analysis: true, offset });
    } else if (urlQuery && urlMode === 'nlp' && nlpResults.length === 0) {
      setSearchForm(prev => ({ ...prev, query: urlQuery }));
      runNLPSearch(urlQuery);
    }
  }, [urlQuery, urlMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch initial contracts on load (only for standard mode without search)
  const { data: initialContracts, isLoading: initialLoading } = useQuery({
    queryKey: ['initial-contracts', currentPage, searchForm.limit],
    queryFn: () => contractsApi.getContracts(currentPage, searchForm.limit),
    enabled: !isSearchMode && searchMode === 'standard' && nlpResults.length === 0,
  });

  const searchMutation = useMutation({
    mutationFn: (data: SearchForm & { offset?: number }) => apiService.searchContracts(data),
    onSuccess: (data, variables) => {
      setSearchResult(data);
      setIsSearchMode(true);
      cacheResults(variables.query, data);
    },
  });

  // NLP Search function
  const runNLPSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setIsNlpSearching(true);
    try {
      const response = await apiService.naturalLanguageSearch({
        query: searchTerm,
        includeSemantic: true,
        userContext: {}
      });
      const newResults = response.results || [];
      const newExplanation = response.explanation || '';
      setNlpResults(newResults);
      setNlpExplanation(newExplanation);
      cacheNLPResults(searchTerm, newResults, newExplanation);
    } catch (error) {
      console.error('NLP Search error:', error);
    } finally {
      setIsNlpSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchForm.query.trim()) {
      setCurrentPage(1);
      updateUrl(1, searchForm.query, searchForm.limit, searchMode);

      if (searchMode === 'standard') {
        searchMutation.mutate({ ...searchForm, offset: 0 });
      } else {
        runNLPSearch(searchForm.query);
      }
    }
  };

  const handleExampleClick = (example: string) => {
    setSearchForm({ ...searchForm, query: example });
    setCurrentPage(1);
    updateUrl(1, example, searchForm.limit, 'nlp');
    runNLPSearch(example);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateUrl(page, searchForm.query, searchForm.limit, searchMode);
    if (searchMode === 'standard' && isSearchMode) {
      const offset = (page - 1) * searchForm.limit;
      searchMutation.mutate({ ...searchForm, offset });
    }
  };

  const handleClearSearch = () => {
    setSearchForm({ ...searchForm, query: '' });
    setSearchResult(null);
    setNlpResults([]);
    setNlpExplanation('');
    setIsSearchMode(false);
    setCurrentPage(1);
    setSearchParams({}, { replace: true });
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setShowModeDropdown(false);
    // Clear results when switching modes
    if (mode !== searchMode) {
      setSearchResult(null);
      setNlpResults([]);
      setNlpExplanation('');
      setIsSearchMode(false);
      if (searchForm.query) {
        updateUrl(1, searchForm.query, searchForm.limit, mode);
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper to check if contract has document attachments
  const hasDocumentAttachments = (contract: any): boolean => {
    if (!contract.resourceLinks || !Array.isArray(contract.resourceLinks)) {
      return false;
    }
    return contract.resourceLinks.length > 0;
  };

  const getDocumentCount = (contract: any): number => {
    if (!contract.resourceLinks || !Array.isArray(contract.resourceLinks)) {
      return 0;
    }
    return contract.resourceLinks.length;
  };

  // Get display data based on mode
  const contracts = searchMode === 'standard'
    ? (isSearchMode
        ? searchResult?.results || []
        : (initialContracts as any)?.contracts || (initialContracts as any)?.data || [])
    : nlpResults;

  const totalCount = searchMode === 'standard'
    ? (isSearchMode
        ? searchResult?.pagination?.total || searchResult?.results.length || 0
        : (initialContracts as any)?.pagination?.total || contracts.length)
    : nlpResults.length;

  const totalPages = Math.ceil(totalCount / searchForm.limit);
  const isLoading = searchMode === 'standard'
    ? (isSearchMode ? searchMutation.isPending : initialLoading)
    : isNlpSearching;

  // For NLP mode, paginate client-side
  const paginatedContracts = searchMode === 'nlp'
    ? contracts.slice((currentPage - 1) * searchForm.limit, currentPage * searchForm.limit)
    : contracts;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {searchMode === 'nlp' && (
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
          )}
          <h1 className="text-2xl font-semibold text-gray-900">
            {searchMode === 'nlp' ? 'AI-Powered Search' : 'Search Contracts'}
          </h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {searchMode === 'nlp'
            ? 'Search contracts using natural language queries'
            : 'Browse and search government contracts'
          } - click on a contract to view full details
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          {/* Search Mode Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModeDropdown(!showModeDropdown)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                searchMode === 'nlp'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-gray-50 border-gray-300 text-gray-700'
              }`}
            >
              {searchMode === 'nlp' ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <SearchIcon className="h-4 w-4" />
              )}
              {searchMode === 'nlp' ? 'AI Search' : 'Standard'}
              <ChevronDown className={`h-4 w-4 transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showModeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  type="button"
                  onClick={() => handleModeChange('standard')}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-gray-50 ${
                    searchMode === 'standard' ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <SearchIcon className="h-4 w-4 text-gray-500" />
                  <div>
                    <div className="font-medium">Standard Search</div>
                    <div className="text-xs text-gray-500">Keyword matching</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('nlp')}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-gray-50 border-t ${
                    searchMode === 'nlp' ? 'bg-indigo-50 font-medium' : ''
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <div>
                    <div className="font-medium text-indigo-700">AI Search</div>
                    <div className="text-xs text-gray-500">Natural language</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="flex-1 relative">
            {searchMode === 'nlp' ? (
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />
            ) : (
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            )}
            <input
              type="text"
              placeholder={searchMode === 'nlp'
                ? "Ask anything... e.g., 'Find IT contracts under $500K'"
                : "Search contracts by keyword, agency, or NAICS code..."
              }
              value={searchForm.query}
              onChange={(e) => setSearchForm({ ...searchForm, query: e.target.value })}
              className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                searchMode === 'nlp'
                  ? 'border-indigo-200 focus:ring-indigo-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
              }`}
            />
          </div>

          <select
            value={searchForm.limit}
            onChange={(e) => {
              const newLimit = parseInt(e.target.value);
              setSearchForm({ ...searchForm, limit: newLimit });
              setCurrentPage(1); // Reset to page 1 when changing limit
            }}
            className={`px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
              searchMode === 'nlp'
                ? 'border-indigo-200 focus:ring-indigo-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>

          <button
            type="submit"
            disabled={isLoading || !searchForm.query.trim()}
            className={`px-6 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              searchMode === 'nlp'
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {searchMode === 'nlp' ? 'Analyzing...' : 'Searching...'}
              </>
            ) : (
              <>
                {searchMode === 'nlp' ? <Sparkles className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
                Search
              </>
            )}
          </button>

          {(isSearchMode || nlpResults.length > 0) && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </form>

        {/* Example Queries for NLP mode */}
        {searchMode === 'nlp' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Try:</span>
              {exampleQueries.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Explanation (NLP mode only) */}
      {searchMode === 'nlp' && nlpExplanation && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-indigo-900">AI Interpretation</p>
              <p className="text-sm text-indigo-700 mt-1">{nlpExplanation}</p>
            </div>
          </div>
        </div>
      )}

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
      {!isLoading && paginatedContracts.length > 0 && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {isSearchMode || nlpResults.length > 0 ? 'Found' : 'Showing'} <strong className="text-gray-900">{totalCount}</strong> contracts
              {searchResult?.response_time && searchMode === 'standard' && ` in ${searchResult.response_time.toFixed(2)}s`}
            </span>
            <span>Page {currentPage} of {totalPages || 1}</span>
          </div>

          {/* Results List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="divide-y divide-gray-100">
              {paginatedContracts.map((contract: any, i: number) => (
                <Link
                  key={contract.id || contract.noticeId || i}
                  to={`/contracts/${contract.noticeId}`}
                  className="block px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-medium text-gray-900 mb-1 ${
                        searchMode === 'nlp' ? 'group-hover:text-indigo-600' : 'group-hover:text-blue-600'
                      }`}>
                        {contract.title || 'Untitled Contract'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
                        {hasDocumentAttachments(contract) && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded">
                            <Paperclip className="h-3 w-3" />
                            {getDocumentCount(contract)} Docs
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Score badge */}
                      {searchMode === 'nlp' && contract.scores?.overall && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          contract.scores.overall >= 0.8 ? 'bg-green-100 text-green-700' :
                          contract.scores.overall >= 0.5 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {(contract.scores.overall * 100).toFixed(0)}% match
                        </span>
                      )}
                      {searchMode === 'standard' && contract.semanticScore > 0 && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          contract.semanticScore >= 80 ? 'bg-green-100 text-green-700' :
                          contract.semanticScore >= 50 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {contract.semanticScore}% match
                        </span>
                      )}
                      <ChevronRight className={`h-5 w-5 text-gray-400 transition-colors ${
                        searchMode === 'nlp' ? 'group-hover:text-indigo-500' : 'group-hover:text-blue-500'
                      }`} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages >= 1 && (
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="text-sm text-gray-500">
                Showing <strong>{((currentPage - 1) * searchForm.limit) + 1}</strong> to <strong>{Math.min(currentPage * searchForm.limit, totalCount)}</strong> of <strong>{totalCount}</strong> results
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
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
                              ? searchMode === 'nlp' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'
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
        </div>
      )}

      {/* Empty State */}
      {!isLoading && paginatedContracts.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-16 text-center">
          {searchMode === 'nlp' ? (
            <>
              <Sparkles className="h-12 w-12 text-indigo-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI-Powered Contract Search</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Ask natural language questions like "Find IT contracts under $500K" or try one of the examples above
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
