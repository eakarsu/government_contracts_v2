import React from 'react';
import SearchPagination from './SearchPagination';

interface SearchResultItem {
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
  semanticScore?: number;
  keywordScore?: number;
  naicsMatch?: number;
  id?: number;
  noticeId?: string;
  notice_id?: string;
  postedDate?: string;
}

interface SearchResultsProps {
  results: SearchResultItem[];
  loading: boolean;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  onLoadMore: (action?: 'prev' | 'next' | 'page', page?: number) => void;
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
        {/* Debug info - remove this after testing */}
        <div className="text-xs text-gray-500">
          Debug: total={pagination.total}, limit={pagination.limit}, offset={pagination.offset}, hasMore={pagination.hasMore ? 'true' : 'false'}
        </div>
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
                  {Number.isFinite(result.combined_score) ? Math.round(result.combined_score * 100) : 
                   Number.isFinite(result.semanticScore) ? result.semanticScore :
                   Number.isFinite(result.semantic_score) ? Math.round(result.semantic_score * 100) : 0}% match
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm text-gray-600">
              <div>
                <span className="font-medium">Agency:</span> {result.agency}
              </div>
              <div>
                <span className="font-medium">Value:</span> {
                  Number.isFinite(result.estimated_value) && result.estimated_value > 0 
                    ? `$${result.estimated_value.toLocaleString()}` 
                    : 'Not specified'
                }
              </div>
              <div>
                <span className="font-medium">Posted:</span> {new Date(result.posted_date).toLocaleDateString()}
              </div>
            </div>

            <p className="text-gray-700 mb-3">
              {result.description?.substring(0, 300)}...
            </p>

            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Semantic: {result.semanticScore || Math.round((result.semantic_score || 0) * 100)}%</span>
              <span>Keyword: {result.keywordScore || Math.round((result.keyword_score || 0) * 100)}%</span>
              <span>NAICS: {result.naicsMatch || (result.naics_code ? 85 : 0)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {pagination.total > 0 && (
        <SearchPagination
          pagination={pagination}
          loading={loading}
          onPageChange={onLoadMore}
        />
      )}
    </div>
  );
};

export default SearchResults;
