import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Building2,
  Calendar,
  FileText,
  X,
  Lightbulb,
  Filter,
  ChevronDown
} from 'lucide-react';
import { apiService } from '../services/api';

interface SearchResult {
  id: string;
  noticeId: string;
  title: string;
  description: string;
  agency: string;
  naicsCode: string;
  postedDate: string;
  setAsideCode: string;
  scores?: {
    semantic: number;
    keyword: number;
    relevance: number;
    overall: number;
  };
}

const NLPSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [explanation, setExplanation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedContract, setSelectedContract] = useState<SearchResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    includeSemantic: true,
    minScore: 0.5,
  });
  const pageSize = 20;

  const handleSearch = async (searchQuery?: string) => {
    const searchTerm = searchQuery || query;
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      const response = await apiService.naturalLanguageSearch({
        query: searchTerm,
        includeSemantic: filters.includeSemantic,
        userContext: {}
      });
      setResults(response.results || []);
      setExplanation(response.explanation || '');
      setCurrentPage(1);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
          Search contracts using natural language queries
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
                <div
                  key={result.id}
                  className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedContract(result)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">
                        {result.title || 'Untitled Contract'}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                        {result.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
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
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                      onClick={() => setCurrentPage(pageNum)}
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

      {/* Contract Detail Modal */}
      {selectedContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedContract(null)}>
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Contract Details</h2>
              <button
                onClick={() => setSelectedContract(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {selectedContract.title}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Agency</p>
                  <p className="text-sm font-medium text-gray-900">{selectedContract.agency}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Posted Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(selectedContract.postedDate)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">NAICS Code</p>
                  <p className="text-sm font-medium text-gray-900">{selectedContract.naicsCode || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Set-Aside</p>
                  <p className="text-sm font-medium text-gray-900">{selectedContract.setAsideCode || 'None'}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedContract.description || 'No description available'}
                </p>
              </div>

              {selectedContract.scores && (
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <p className="text-xs font-medium text-indigo-900 mb-3">Match Scores</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-indigo-600">{(selectedContract.scores.overall * 100).toFixed(0)}%</p>
                      <p className="text-xs text-indigo-700">Overall</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{(selectedContract.scores.semantic * 100).toFixed(0)}%</p>
                      <p className="text-xs text-blue-700">Semantic</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{(selectedContract.scores.keyword * 100).toFixed(0)}%</p>
                      <p className="text-xs text-green-700">Keyword</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <Link
                to={`/contracts/${selectedContract.noticeId}`}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 text-center"
              >
                View Full Details
              </Link>
              <a
                href={`https://sam.gov/opp/${selectedContract.noticeId}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                SAM.gov
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NLPSearch;
