import React from 'react';

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

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  onLoadMore: () => void;
  query: string;
}

const SearchResults: React.FC<SearchResultsProps> = ({ 
  results, 
  loading, 
  pagination, 
  onLoadMore, 
  query 
}) => {
  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Searching contracts...</span>
      </div>
    );
  }

  if (!loading && results.length === 0 && query) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
        <p className="text-gray-600">
          Try adjusting your search terms or filters to find relevant contracts.
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Search Results ({pagination.total})
        </h2>
      </div>

      <div className="space-y-4">
        {results.map((result) => (
          <div
            key={result.contract_id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900 hover:text-blue-600">
                <a href={`/contracts/${result.contract_id}`}>
                  {result.title}
                </a>
              </h3>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {Math.round(result.combined_score * 100)}% match
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm text-gray-600">
              <div>
                <span className="font-medium">Agency:</span> {result.agency}
              </div>
              <div>
                <span className="font-medium">Value:</span> ${result.estimated_value?.toLocaleString() || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Posted:</span> {new Date(result.posted_date).toLocaleDateString()}
              </div>
            </div>

            <p className="text-gray-700 mb-3">
              {result.description?.substring(0, 300)}...
            </p>

            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Semantic: {Math.round(result.semantic_score * 100)}%</span>
              <span>Keyword: {Math.round(result.keyword_score * 100)}%</span>
              <span>NAICS: {result.naics_code}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {pagination.hasMore && (
        <div className="text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
