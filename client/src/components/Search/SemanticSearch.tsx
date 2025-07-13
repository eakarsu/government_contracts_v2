import React, { useState, useEffect } from 'react';
import { Search, Filter, History, Sparkles, ChevronDown, X } from 'lucide-react';

interface SearchFilters {
  agency?: string;
  naicsCode?: string;
  minValue?: number;
  maxValue?: number;
  postedAfter?: string;
  deadlineBefore?: string;
}

interface SearchResult {
  id: string;
  noticeId: string;
  title: string;
  description: string;
  agency: string;
  naicsCode: string;
  contractValue: number;
  postedDate: string;
  responseDeadline: string;
  similarity: number;
  contentSummary: string;
}

interface SearchHistory {
  query: string;
  resultsCount: number;
  searchedAt: string;
}

const SemanticSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});

  const [threshold, setThreshold] = useState(0.7);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/semantic-search/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchHistory(data.searchHistory);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const expandQuery = async (queryText: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/semantic-search/expand-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ queryText })
      });

      if (response.ok) {
        const data = await response.json();
        setExpandedTerms(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to expand query:', error);
    }
  };

  const performSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/semantic-search/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          queryText: searchQuery,
          filters,
          limit,
          threshold
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
        loadSearchHistory(); // Refresh history
      } else {
        console.error('Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.length > 3) {
      expandQuery(value);
    } else {
      setExpandedTerms([]);
    }
  };

  const clearFilters = () => {
    setFilters({});
  };

  const formatCurrency = (value: number) => {
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

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.9) return 'text-green-600 bg-green-100';
    if (similarity >= 0.8) return 'text-blue-600 bg-blue-100';
    if (similarity >= 0.7) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          <Sparkles className="inline-block w-8 h-8 mr-2 text-blue-600" />
          AI-Powered Contract Search
        </h1>
        <p className="text-gray-600">
          Use natural language to find relevant government contracts with semantic understanding
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Describe what you're looking for... (e.g., 'cybersecurity consulting for federal agencies')"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Expanded Terms */}
          {expandedTerms.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-700 mb-2">Related search terms:</p>
              <div className="flex flex-wrap gap-2">
                {expandedTerms.map((term, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleQueryChange(term)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-center">
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
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

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              History
            </button>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Similarity:</label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-20"
              />
              <span className="text-sm text-gray-600">{Math.round(threshold * 100)}%</span>
            </div>
          </div>
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agency</label>
                <input
                  type="text"
                  value={filters.agency || ''}
                  onChange={(e) => setFilters({ ...filters, agency: e.target.value })}
                  placeholder="e.g., Department of Defense"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NAICS Code</label>
                <input
                  type="text"
                  value={filters.naicsCode || ''}
                  onChange={(e) => setFilters({ ...filters, naicsCode: e.target.value })}
                  placeholder="e.g., 541511"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Value ($)</label>
                <input
                  type="number"
                  value={filters.minValue || ''}
                  onChange={(e) => setFilters({ ...filters, minValue: parseInt(e.target.value) || undefined })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Value ($)</label>
                <input
                  type="number"
                  value={filters.maxValue || ''}
                  onChange={(e) => setFilters({ ...filters, maxValue: parseInt(e.target.value) || undefined })}
                  placeholder="1000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Posted After</label>
                <input
                  type="date"
                  value={filters.postedAfter || ''}
                  onChange={(e) => setFilters({ ...filters, postedAfter: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline Before</label>
                <input
                  type="date"
                  value={filters.deadlineBefore || ''}
                  onChange={(e) => setFilters({ ...filters, deadlineBefore: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Search History */}
        {showHistory && searchHistory.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Searches</h3>
            <div className="space-y-2">
              {searchHistory.slice(0, 5).map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(item.query);
                    setShowHistory(false);
                  }}
                  className="w-full text-left p-2 hover:bg-white rounded border text-sm"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900">{item.query}</span>
                    <span className="text-gray-500">{item.resultsCount} results</span>
                  </div>
                  <div className="text-gray-500 text-xs">
                    {formatDate(item.searchedAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              Search Results ({results.length})
            </h2>
          </div>

          {results.map((result) => (
            <div key={result.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {result.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {result.agency} • Notice ID: {result.noticeId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSimilarityColor(result.similarity)}`}>
                    {Math.round(result.similarity * 100)}% match
                  </span>
                </div>
              </div>

              <p className="text-gray-700 mb-4 line-clamp-3">
                {result.description}
              </p>

              {result.contentSummary && (
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>AI Summary:</strong> {result.contentSummary}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">NAICS Code:</span>
                  <p className="font-medium">{result.naicsCode || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Value:</span>
                  <p className="font-medium">
                    {result.contractValue ? formatCurrency(result.contractValue) : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Posted:</span>
                  <p className="font-medium">{formatDate(result.postedDate)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Deadline:</span>
                  <p className="font-medium">{formatDate(result.responseDeadline)}</p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && query && results.length === 0 && (
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
