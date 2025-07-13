import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import SearchFilters from './SearchFilters';
import SearchResults from './SearchResults';
import SearchSuggestions from './SearchSuggestions';
import SearchHistory from './SearchHistory';

interface SearchFilters {
  agency?: string;
  naics_code?: string;
  min_value?: number;
  max_value?: number;
  date_from?: string;
  date_to?: string;
  set_aside?: string;
}

interface SearchResult {
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
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  query_info: {
    original_query: string;
    semantic_results_count: number;
    keyword_results_count: number;
  };
}

const SemanticSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
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

  const performSearch = async (searchQuery: string, searchFilters: SearchFilters = {}, offset: number = 0) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          filters: searchFilters,
          options: {
            limit: pagination.limit,
            offset,
            includeSemanticSearch: true
          }
        })
      });

      if (response.ok) {
        const data: SearchResponse = await response.json();
        if (data.success) {
          if (offset === 0) {
            setResults(data.results);
          } else {
            setResults(prev => [...prev, ...data.results]);
          }
          setPagination(data.pagination);
          setQueryInfo(data.query_info);
        } else {
          setError('Search failed. Please try again.');
        }
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

  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (query.trim()) {
      performSearch(query, newFilters, 0);
    }
  };

  const handleLoadMore = () => {
    if (pagination.hasMore && !loading) {
      performSearch(query, filters, pagination.offset + pagination.limit);
    }
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
            <SearchFilters
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
