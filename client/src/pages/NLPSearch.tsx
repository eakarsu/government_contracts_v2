import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Sparkles,
  RefreshCw,
  Building2,
  Calendar,
  Lightbulb,
  Filter,
  ChevronDown,
  ChevronRight,
  Paperclip
} from 'lucide-react';
import { apiService } from '../services/api';

interface SearchResult {
  id: string;
  noticeId: string;
  title: string;
  description: string;
  agency: string;
  naicsCode: string;
  classificationCode?: string;
  postedDate: string;
  setAsideCode: string;
  resourceLinks?: string[];
  scores?: {
    semantic: number;
    keyword: number;
    relevance: number;
    overall: number;
  };
}

const NLPSearch: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get URL parameters on every render
  const urlQuery = searchParams.get('q') || '';
  const urlPage = parseInt(searchParams.get('page') || '1');

  // Try to restore cached results from sessionStorage
  const getCachedResults = () => {
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

  const [query, setQuery] = useState(urlQuery);
  const [results, setResults] = useState<SearchResult[]>(cachedData?.results || []);
  const [explanation, setExplanation] = useState(cachedData?.explanation || '');
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [filters, setFilters] = useState({
    includeSemantic: true,
    minScore: 0.5,
  });
  const pageSize = 20;

  // Update URL when page or search changes
  const updateUrl = (page: number, searchQuery: string) => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (page > 1) params.page = page.toString();
    setSearchParams(params, { replace: true });
  };

  // Cache results in sessionStorage
  const cacheResults = (searchQuery: string, searchResults: SearchResult[], searchExplanation: string) => {
    try {
      sessionStorage.setItem('nlpSearchCache', JSON.stringify({
        query: searchQuery,
        results: searchResults,
        explanation: searchExplanation
      }));
    } catch (e) {}
  };

  // Only run search if URL has query but no cached results
  useEffect(() => {
    if (urlQuery && results.length === 0 && !isSearching) {
      setQuery(urlQuery);
      setCurrentPage(urlPage);
      runSearch(urlQuery);
    }
  }, [urlQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      const response = await apiService.naturalLanguageSearch({
        query: searchTerm,
        includeSemantic: filters.includeSemantic,
        userContext: {}
      });
      const newResults = response.results || [];
      const newExplanation = response.explanation || '';
      setResults(newResults);
      setExplanation(newExplanation);
      cacheResults(searchTerm, newResults, newExplanation);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const searchTerm = searchQuery || query;
    if (!searchTerm.trim()) return;

    setCurrentPage(1);
    updateUrl(1, searchTerm);
    await runSearch(searchTerm);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateUrl(page, query);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper to check if contract has document attachments
  const hasDocumentAttachments = (contract: SearchResult): boolean => {
    if (!contract.resourceLinks || !Array.isArray(contract.resourceLinks)) {
      return false;
    }
    // Show attachment indicator if there are any resourceLinks
    // SAM.gov links often end with /download without file extension
    return contract.resourceLinks.length > 0;
  };

  const getDocumentCount = (contract: SearchResult): number => {
    if (!contract.resourceLinks || !Array.isArray(contract.resourceLinks)) {
      return 0;
    }
    return contract.resourceLinks.length;
  };

  const exampleQueries = [
    "IT contracts under $500K",
    "Construction projects in California",
    "Small business set-aside",
    "System upgrades",
  ];

  // Pagination
  const totalPages = Math.ceil(results.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedResults = results.slice(startIndex, startIndex + pageSize);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Sparkles className="h-5 w-5 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">AI-Powered Search</h1>
        </div>
        <p className="text-sm text-gray-500">
          Search contracts using natural language queries - click on a contract to view full details
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />
            <input
              type="text"
              placeholder="Ask anything... e.g., 'Find IT contracts under $500K'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Example Queries */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Try:</span>
          {exampleQueries.map((example, i) => (
            <button
              key={i}
              onClick={() => { setQuery(example); handleSearch(example); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
          >
            <Filter className="h-3.5 w-3.5" />
            Advanced Filters
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {showFilters && (
            <div className="mt-3 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.includeSemantic}
                  onChange={(e) => setFilters({...filters, includeSemantic: e.target.checked})}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">Semantic search</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Min score:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={filters.minScore}
                  onChange={(e) => setFilters({...filters, minScore: parseFloat(e.target.value)})}
                  className="w-20"
                />
                <span className="text-xs text-gray-500 w-8">{(filters.minScore * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Explanation */}
      {explanation && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-indigo-900">AI Interpretation</p>
              <p className="text-sm text-indigo-700 mt-1">{explanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Found <strong className="text-gray-900">{results.length}</strong> contracts
            </span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>

          {/* Results List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="divide-y divide-gray-100">
              {paginatedResults.map((result) => (
                <Link
                  key={result.id || result.noticeId}
                  to={`/contracts/${result.noticeId}`}
                  className="block px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 mb-1 group-hover:text-indigo-600">
                        {result.title || 'Untitled Contract'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {result.agency?.split('.')[0] || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(result.postedDate)}
                        </span>
                        {result.naicsCode && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                            NAICS: {result.naicsCode}
                          </span>
                        )}
                        {hasDocumentAttachments(result) && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded">
                            <Paperclip className="h-3 w-3" />
                            {getDocumentCount(result)} Docs
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {result.scores && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          result.scores.overall >= 0.8 ? 'bg-green-100 text-green-700' :
                          result.scores.overall >= 0.5 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {(result.scores.overall * 100).toFixed(0)}% match
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
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
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  if (pageNum < 1 || pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-10 h-10 text-sm rounded-lg ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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
      {!results.length && !isSearching && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-16 text-center">
          <Sparkles className="h-12 w-12 text-indigo-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">AI-Powered Contract Search</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Ask natural language questions like "Find IT contracts under $500K" or "Show me construction projects in California"
          </p>
        </div>
      )}
    </div>
  );
};

export default NLPSearch;
