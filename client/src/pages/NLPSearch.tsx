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
  FileText,
  X,
  Building,
  Hash,
  Tag
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
  const [selectedContract, setSelectedContract] = useState<SearchResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    includeSemantic: true,
    minScore: 0.5,
    maxResults: 50
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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
      setCurrentPage(1);
      
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

  const handleViewDetails = (contract: SearchResult) => {
    setSelectedContract(contract);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedContract(null);
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

  // Pagination calculations
  const totalResults = searchResults.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedResults = searchResults.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
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
          Search contracts using natural language queries. Ask questions like "Find IT contracts under $500K in California" or "Show me system upgrades and technology projects".
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
            "System upgrades and technology projects",
            "Equipment maintenance and repair services"
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

      {/* Pagination Controls */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            
            <div className="text-sm text-gray-600">
              {totalResults} total results - Page {currentPage} of {totalPages}
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-4">
        {paginatedResults.map((result) => (
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

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewDetails(result)}
                    className="inline-flex items-center px-3 py-1.5 text-sm text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Details
                  </button>
                  {result.resourceLinks && result.resourceLinks.length > 0 && (
                    <a
                      href={result.resourceLinks[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open SAM.gov
                    </a>
                  )}
                </div>
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

      {/* Pagination Navigation */}
      {searchResults.length > 0 && totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }
                  
                  if (pageNumber < 1 || pageNumber > totalPages) return null;
                  
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        pageNumber === currentPage
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1}-{Math.min(endIndex, totalResults)} of {totalResults} results
            </div>
          </div>
        </div>
      )}

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

      {/* Contract Detail Modal */}
      {showModal && selectedContract && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Contract Details</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Title Section */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedContract.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {selectedContract.naicsCode}
                  </span>
                  {selectedContract.setAsideCode && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {selectedContract.setAsideCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Key Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Agency</p>
                    <p className="text-sm text-gray-600">{selectedContract.agency}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Posted Date</p>
                    <p className="text-sm text-gray-600">{formatDate(selectedContract.postedDate)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Hash className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Notice ID</p>
                    <p className="text-sm text-gray-600 font-mono text-xs">{selectedContract.noticeId}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Classification Code</p>
                    <p className="text-sm text-gray-600">{selectedContract.classificationCode}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Description</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {selectedContract.description || 'No description available'}
                </p>
              </div>

              {/* Resource Links */}
              {selectedContract.resourceLinks && selectedContract.resourceLinks.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Resources</h4>
                  <div className="space-y-2">
                    {selectedContract.resourceLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 p-2 hover:bg-purple-50 rounded transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Resource {index + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Scores */}
              {selectedContract.scores && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Search Relevance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Overall Match</span>
                      <span className="text-sm font-medium text-purple-600">
                        {(selectedContract.scores.overall * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Semantic Score</span>
                      <span className="text-sm font-medium text-blue-600">
                        {(selectedContract.scores.semantic * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Keyword Score</span>
                      <span className="text-sm font-medium text-green-600">
                        {(selectedContract.scores.keyword * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <a
                  href={`https://sam.gov/opp/${selectedContract.noticeId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on SAM.gov
                </a>
                <button
                  onClick={closeModal}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NLPSearch;