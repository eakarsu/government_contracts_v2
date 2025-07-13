import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Search, Filter, History, Sparkles, ChevronDown, X, TrendingUp, Brain } from 'lucide-react';

interface SearchFilters {
  agency?: string;
  contractType?: string;
  minValue?: number;
  maxValue?: number;
  dateFrom?: string;
  dateTo?: string;
  location?: string;
}

interface SearchResult {
  id: string;
  notice_id?: string;
  title: string;
  description: string;
  agency: string;
  contract_value: number;
  posted_date: string;
  content_summary?: string;
  relevanceScore: number;
  combinedScore?: number;
}

interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
  searchType?: string;
}

const SemanticSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [searchType, setSearchType] = useState<'semantic' | 'hybrid'>('hybrid');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async ({ query, filters, searchType }: { 
      query: string; 
      filters: SearchFilters; 
      searchType: 'semantic' | 'hybrid' 
    }) => {
      const response = await fetch(`/api/search/${searchType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          filters,
          limit: 20,
          threshold: 0.7
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      return response.json() as Promise<SearchResponse>;
    },
  });

  // Search suggestions
  const getSuggestions = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const suggestions = await response.json();
          setSuggestions(suggestions);
        }
      } catch (error) {
        console.error('Failed to get suggestions:', error);
      }
    }, 300),
    []
  );

  // Search history
  const { data: searchHistory } = useQuery({
    queryKey: ['searchHistory'],
    queryFn: async () => {
      const response = await fetch('/api/search/history');
      if (!response.ok) return [];
      return response.json();
    },
  });

  useEffect(() => {
    getSuggestions(query);
  }, [query, getSuggestions]);

  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (finalQuery.trim()) {
      searchMutation.mutate({ query: finalQuery, filters, searchType });
      setShowSuggestions(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const formatCurrency = (value: number) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.9) return 'bg-green-100 text-green-800';
    if (score >= 0.8) return 'bg-blue-100 text-blue-800';
    if (score >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
          <Brain className="w-8 h-8 mr-3 text-blue-600" />
          AI-Powered Contract Search
        </h1>
        <p className="text-gray-600">
          Use natural language to find relevant government contracts with semantic understanding
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="relative mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Describe what you're looking for... (e.g., 'IT services for healthcare systems')"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* Search Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(suggestion);
                        handleSearch(suggestion);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'semantic' | 'hybrid')}
              className="px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="hybrid">Hybrid Search</option>
              <option value="semantic">Semantic Only</option>
            </select>
            
            <button
              onClick={() => handleSearch()}
              disabled={searchMutation.isPending}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {searchMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Advanced Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          
          {Object.keys(filters).some(key => filters[key as keyof SearchFilters]) && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agency
                </label>
                <select
                  value={filters.agency || ''}
                  onChange={(e) => handleFilterChange('agency', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Agencies</option>
                  <option value="DOD">Department of Defense</option>
                  <option value="GSA">General Services Administration</option>
                  <option value="VA">Veterans Affairs</option>
                  <option value="DHS">Homeland Security</option>
                  <option value="NASA">NASA</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Type
                </label>
                <select
                  value={filters.contractType || ''}
                  onChange={(e) => handleFilterChange('contractType', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="services">Services</option>
                  <option value="supplies">Supplies</option>
                  <option value="construction">Construction</option>
                  <option value="research">Research & Development</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Value ($)
                </label>
                <input
                  type="number"
                  value={filters.minValue || ''}
                  onChange={(e) => handleFilterChange('minValue', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Value ($)
                </label>
                <input
                  type="number"
                  value={filters.maxValue || ''}
                  onChange={(e) => handleFilterChange('maxValue', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="No limit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Posted After
                </label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchMutation.data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Search Results ({searchMutation.data.totalResults})
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <TrendingUp className="h-4 w-4" />
              Search type: {searchMutation.data.searchType || searchType}
            </div>
          </div>

          <div className="space-y-4">
            {searchMutation.data.results.map((result) => (
              <div
                key={result.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900 hover:text-blue-600">
                    <a href={`/contracts/${result.notice_id || result.id}`}>
                      {result.title}
                    </a>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRelevanceColor(result.relevanceScore)}`}>
                      {Math.round(result.relevanceScore * 100)}% match
                    </span>
                    {result.combinedScore && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Combined: {Math.round(result.combinedScore * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Agency:</span> {result.agency}
                  </div>
                  <div>
                    <span className="font-medium">Value:</span> {formatCurrency(result.contract_value)}
                  </div>
                  <div>
                    <span className="font-medium">Posted:</span> {formatDate(result.posted_date)}
                  </div>
                </div>

                <p className="text-gray-700 mb-3">
                  {result.description?.substring(0, 300)}...
                </p>

                {result.content_summary && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <h4 className="font-medium text-blue-900 mb-1">AI Summary:</h4>
                    <p className="text-blue-800 text-sm">{result.content_summary}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search History */}
      {searchHistory && searchHistory.length > 0 && (
        <div className="mt-8 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center">
            <History className="h-4 w-4 mr-2" />
            Recent Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {searchHistory.slice(0, 5).map((item: any, index: number) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(item.query_text);
                  handleSearch(item.query_text);
                }}
                className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50"
              >
                {item.query_text} ({item.results_count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {searchMutation.isPending && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Searching contracts...</span>
        </div>
      )}

      {/* Error State */}
      {searchMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            Search failed. Please try again or contact support.
          </p>
        </div>
      )}

      {/* No Results */}
      {searchMutation.data && searchMutation.data.results.length === 0 && (
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
          <p className="text-gray-600">
            Try adjusting your search terms or filters to find relevant contracts.
          </p>
        </div>
      )}
    </div>
  );
};

export default SemanticSearch;
