import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { apiService } from '../../services/api';
import SearchFiltersComponent from './SearchFilters';
import SearchResults from './SearchResults';
import SearchSuggestions from './SearchSuggestions';
import SearchHistory from './SearchHistory';

interface SearchFiltersInterface {
  agency?: string;
  naics_code?: string;
  min_value?: number;
  max_value?: number;
  date_from?: string;
  date_to?: string;
  set_aside?: string;
}

interface SemanticSearchResult {
  contract_id: string;
  title: string;
  description: string;
  agency: string;
  naics_code: string;
  estimated_value: number;
  posted_date: string;
  semantic_score: number;
  keyword_score: number;
  combined_score: number;
  // Additional properties that might come from Contract type
  id?: number;
  noticeId?: string;
  notice_id?: string;
  postedDate?: string;
  semanticScore?: number;
  keywordScore?: number;
  naicsMatch?: number;
}

interface SemanticSearchResponse {
  success: boolean;
  results: any[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  query_info?: {
    original_query: string;
    semantic_results_count: number;
    keyword_results_count: number;
  };
  ai_analysis?: any;
  query?: string;
  search_method?: string;
  response_time?: number;
}

const SemanticSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFiltersInterface>({});
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 1000, // Set very high limit to get all results
    offset: 0,
    hasMore: false
  });
  const [queryInfo, setQueryInfo] = useState<any>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Get search suggestions
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      getSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  const getSuggestions = async (partialQuery: string) => {
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(partialQuery)}&limit=5`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuggestions(data.suggestions);
        }
      }
    } catch (error) {
      console.error('Error getting suggestions:', error);
    }
  };

  const performSearch = async (searchQuery: string, searchFilters: SearchFiltersInterface = {}, offset: number = 0) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Use the same API service as the working Search page
      const searchData = {
        query: searchQuery,
        ...searchFilters,
        limit: pagination.limit,
        offset,
        include_analysis: true
      };

      console.log('🔍 [DEBUG] SemanticSearch sending request with limit:', searchData.limit);
      console.log('🔍 [DEBUG] SemanticSearch full request:', searchData);

      const data = await apiService.searchContracts(searchData);
      console.log('Full search response:', data);
      
      if (data.success) {
        // Always replace results for pagination (not append)
        console.log('Search response results count:', data.results.length);
        console.log('Pagination data:', data.pagination);
        
        // Transform Contract[] to SemanticSearchResult[] if needed
        const transformedResults: SemanticSearchResult[] = data.results.map((result: any) => ({
          contract_id: result.contract_id || result.noticeId || result.notice_id || result.id?.toString() || '',
          title: result.title || 'Untitled',
          description: result.description || '',
          agency: result.agency || 'N/A',
          naics_code: result.naics_code || result.naicsCode || '',
          estimated_value: result.estimated_value || 0,
          posted_date: result.posted_date || result.postedDate || '',
          semantic_score: result.semantic_score || result.semanticScore || 0,
          keyword_score: result.keyword_score || result.keywordScore || 0,
          combined_score: result.combined_score || result.semanticScore || 0,
          // Keep additional properties
          id: result.id,
          noticeId: result.noticeId,
          notice_id: result.notice_id,
          postedDate: result.postedDate,
          semanticScore: result.semanticScore,
          keywordScore: result.keywordScore,
          naicsMatch: result.naicsMatch
        }));
        
        setResults(transformedResults);
        
        // Fix pagination hasMore calculation if backend doesn't provide it correctly
        const paginationData = data.pagination || { total: 0, limit: 20, offset: 0, hasMore: false };
        const fixedPagination = {
          total: paginationData.total || data.results.length,
          limit: paginationData.limit || 20,
          offset: paginationData.offset || 0,
          hasMore: paginationData.hasMore || 
                   ((paginationData.offset || 0) + (paginationData.limit || 20) < (paginationData.total || data.results.length))
        };
        
        console.log('Fixed pagination:', fixedPagination);
        console.log('Should show pagination?', fixedPagination.total > fixedPagination.limit);
        setPagination(fixedPagination);
        setQueryInfo((data as any).query_info || null);
      } else {
        setError('Search failed. Please try again.');
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('An error occurred during search. Please try again.');
    } finally {
      setLoading(false);
      setShowSuggestions(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, filters, 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion, filters, 0);
  };

  const handleFilterChange = (newFilters: SearchFiltersInterface) => {
    setFilters(newFilters);
    if (query.trim()) {
      performSearch(query, newFilters, 0);
    }
  };

  const handleLoadMore = (action?: 'prev' | 'next' | 'page', page?: number) => {
    if (loading) return;
    
    let newOffset = pagination.offset;
    
    if (action === 'prev') {
      newOffset = Math.max(0, pagination.offset - pagination.limit);
    } else if (action === 'next') {
      newOffset = pagination.offset + pagination.limit;
    } else if (action === 'page' && page) {
      newOffset = (page - 1) * pagination.limit;
    } else {
      // Default behavior (original load more)
      if (pagination.hasMore) {
        newOffset = pagination.offset + pagination.limit;
      } else {
        return;
      }
    }
    
    performSearch(query, filters, newOffset);
  };

  const expandQuery = async () => {
    if (!query.trim()) return;

    try {
      const response = await fetch('/api/search/expand-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const expandedTerms = data.expanded_terms.join(', ');
          setQuery(expandedTerms);
          performSearch(expandedTerms, filters, 0);
        }
      }
    } catch (error) {
      console.error('Error expanding query:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AI-Powered Contract Search
        </h1>
        <p className="text-lg text-gray-600">
          Find government contracts using natural language and semantic search
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <form onSubmit={handleSearch} className="relative">
          <div className="flex flex-col space-y-4">
            {/* Main Search Input */}
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search for contracts using natural language (e.g., 'cybersecurity services for federal agencies')"
                className="w-full px-4 py-3 pr-32 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              />
              
              {/* Search Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <SearchSuggestions
                  suggestions={suggestions}
                  onSuggestionClick={handleSuggestionClick}
                />
              )}

              {/* Search Actions */}
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-2">
                <button
                  type="button"
                  onClick={expandQuery}
                  disabled={!query.trim() || loading}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  title="Expand query with AI"
                >
                  🔍+
                </button>
                <button
                  type="submit"
                  disabled={!query.trim() || loading}
                  className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  History
                </button>

                {/* Results Per Page Selector */}
                <div className="flex items-center space-x-2">
                  <label htmlFor="limit" className="text-sm text-gray-700">
                    Results per page:
                  </label>
                  <select
                    id="limit"
                    value={pagination.limit}
                    onChange={(e) => {
                      const newLimit = parseInt(e.target.value);
                      setPagination(prev => ({ ...prev, limit: newLimit, offset: 0 }));
                      if (query.trim()) {
                        performSearch(query, filters, 0);
                      }
                    }}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>500</option>
                    <option value={1000}>All Results</option>
                  </select>
                </div>
              </div>

              {queryInfo && (
                <div className="text-sm text-gray-500">
                  Found {pagination.total} contracts 
                  ({queryInfo.semantic_results_count} semantic, {queryInfo.keyword_results_count} keyword)
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <SearchFiltersComponent
              filters={filters}
              onFiltersChange={handleFilterChange}
            />
          </div>
        )}

        {/* Search History */}
        {showHistory && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <SearchHistory
              onHistoryItemClick={(historyQuery) => {
                setQuery(historyQuery);
                setShowHistory(false);
                performSearch(historyQuery, filters, 0);
              }}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      <SearchResults
        results={results}
        loading={loading}
        pagination={pagination}
        onLoadMore={handleLoadMore}
        query={query}
      />
    </div>
  );
};

export default SemanticSearch;
