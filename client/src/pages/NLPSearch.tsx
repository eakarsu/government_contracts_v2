import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Sparkles, 
  Lightbulb, 
  Clock, 
  TrendingUp,
  MapPin,
  DollarSign,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText
} from 'lucide-react';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import StatsCard from '../components/Dashboard/StatsCard';

interface SearchResult {
  id: string;
  noticeId: string;
  title: string;
  description: string;
  agency: string;
  naicsCode: string;
  classificationCode: string;
  postedDate: string;
  setAsideCode: string;
  resourceLinks: string[];
  indexedAt: string;
  createdAt: string;
  scores?: {
    semantic: number;
    keyword: number;
    relevance: number;
    overall: number;
  };
}

interface SearchSuggestion {
  query: string;
  reason: string;
}

const NLPSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [explanation, setExplanation] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    includeSemantic: true,
    minScore: 0.5,
    maxResults: 50
  });

  // Fetch search suggestions
  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['search-suggestions'],
    queryFn: () => apiService.getNLPSuggestions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleSearch = async (searchQuery?: string) => {
    const searchTerm = searchQuery || query;
    if (!searchTerm.trim()) return;

    try {
      const response = await apiService.naturalLanguageSearch({
        query: searchTerm,
        includeSemantic: filters.includeSemantic,
        userContext: {}
      });

      setSearchResults(response.results || []);
      setExplanation(response.explanation || '');
      
      // Generate personalized suggestions
      const personalizedSuggestions = await apiService.getPersonalizedSuggestions();
      setSuggestions(personalizedSuggestions.suggestions || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return 'Amount TBD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-purple-500" />
          NLP Search
        </h1>
        <p className="mt-2 text-gray-600">
          Search contracts using natural language queries. Ask questions like "Find IT contracts under $500K in California" or "Show me cybersecurity opportunities due this month".
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about government contracts..."
            className="block w-full pl-10 pr-3 py-4 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={() => handleSearch()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Search
            </button>
          </div>
        </div>

        {/* Search Examples */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-gray-600">Try:</span>
          {[
            "IT contracts under $500K",
            "Construction projects in California",
            "Small business set-aside opportunities",
            "Cybersecurity contracts due this month",
            "Consulting services under $1M"
          ].map((example, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(example)}
              className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
            >
              {example}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </button>
          
          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.includeSemantic}
                  onChange={(e) => setFilters({...filters, includeSemantic: e.target.checked})}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">Include semantic search</span>
              </label>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Min Score</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={filters.minScore}
                  onChange={(e) => setFilters({...filters, minScore: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{filters.minScore}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Stats */}
      {searchResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard
            title="Total Results"
            value={searchResults.length}
            icon={<Search className="h-6 w-6" />}
            color="purple"
          />
          <StatsCard
            title="Avg Relevance"
            value={Math.round((searchResults.reduce((acc, r) => acc + (r.scores?.overall || 0), 0) / searchResults.length) * 100)}
            icon={<TrendingUp className="h-6 w-6" />}
            color="blue"
          />
          <StatsCard
            title="Recent Posts"
            value={searchResults.filter(r => {
              const daysSincePosted = (new Date().getTime() - new Date(r.postedDate).getTime()) / (1000 * 60 * 60 * 24);
              return daysSincePosted <= 30;
            }).length}
            icon={<Clock className="h-6 w-6" />}
            color="green"
          />
          <StatsCard
            title="Unique Agencies"
            value={new Set(searchResults.map(r => r.agency)).size}
            icon={<FileText className="h-6 w-6" />}
            color="orange"
          />
        </div>
      )}

      {/* Search Explanation */}
      {explanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Lightbulb className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Search Explanation</h3>
              <p className="mt-1 text-sm text-blue-700">{explanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Personalized Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-purple-800 mb-2">Personalized Suggestions</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion.query)}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200"
              >
                {suggestion.query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-4">
        {searchResults.map((result) => (
          <div key={result.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{result.title}</h3>
                  {result.scores && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {(result.scores.overall * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{result.description}</p>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>{result.agency}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{result.naicsCode}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(result.postedDate)}</span>
                  </div>
                  {result.setAsideCode && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span>{result.setAsideCode}</span>
                    </div>
                  )}
                </div>

                {result.resourceLinks && result.resourceLinks.length > 0 && (
                  <div className="flex gap-2">
                    {result.resourceLinks.slice(0, 2).map((link, index) => (
                      <a
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Details
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {result.scores && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Semantic: {(result.scores.semantic * 100).toFixed(0)}%</span>
                  <span>Keyword: {(result.scores.keyword * 100).toFixed(0)}%</span>
                  <span>Relevance: {(result.scores.relevance * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {searchResults.length === 0 && query && !suggestionsLoading && (
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search terms or expanding your criteria.
          </p>
        </div>
      )}

      {/* Initial State */}
      {searchResults.length === 0 && !query && (
        <div className="text-center py-12">
          <Sparkles className="mx-auto h-12 w-12 text-purple-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Ready to search</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enter a natural language query to find relevant government contracts.
          </p>
        </div>
      )}
    </div>
  );
};

export default NLPSearch;