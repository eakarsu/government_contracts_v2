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
  semanticScore?: number;
  keywordScore?: number;
  naicsMatch?: number;
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
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => onLoadMore('prev')}
              disabled={pagination.offset === 0 || loading}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => onLoadMore('next')}
              disabled={!pagination.hasMore || loading}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{pagination.offset + 1}</span>
                {' '}to{' '}
                <span className="font-medium">
                  {Math.min(pagination.offset + pagination.limit, pagination.total)}
                </span>
                {' '}of{' '}
                <span className="font-medium">{pagination.total}</span>
                {' '}results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => onLoadMore('prev')}
                  disabled={pagination.offset === 0 || loading}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Page Numbers */}
                {(() => {
                  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
                  const totalPages = Math.ceil(pagination.total / pagination.limit);
                  const pages = [];
                  
                  // Always show first page
                  if (currentPage > 3) {
                    pages.push(1);
                    if (currentPage > 4) pages.push('...');
                  }
                  
                  // Show pages around current page
                  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                    pages.push(i);
                  }
                  
                  // Always show last page
                  if (currentPage < totalPages - 2) {
                    if (currentPage < totalPages - 3) pages.push('...');
                    pages.push(totalPages);
                  }
                  
                  return pages.map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={index} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                          ...
                        </span>
                      );
                    }
                    
                    const isCurrentPage = page === currentPage;
                    return (
                      <button
                        key={page}
                        onClick={() => onLoadMore('page', page as number)}
                        disabled={loading}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                          isCurrentPage
                            ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                        } disabled:opacity-50`}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}
                
                <button
                  onClick={() => onLoadMore('next')}
                  disabled={!pagination.hasMore || loading}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
