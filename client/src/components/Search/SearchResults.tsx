import React from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, Building2, DollarSign, Calendar, Sparkles, Tag, TrendingUp } from 'lucide-react';
import Card from '../UI/Card';
import Badge from '../UI/Badge';
import Pagination from '../UI/Pagination';
import Skeleton from '../UI/Skeleton';

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
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const getMatchScore = (result: SearchResultItem): number => {
    if (Number.isFinite(result.combined_score)) return Math.round(result.combined_score * 100);
    if (Number.isFinite(result.semanticScore)) return result.semanticScore || 0;
    if (Number.isFinite(result.semantic_score)) return Math.round(result.semantic_score * 100);
    return 0;
  };

  const getMatchVariant = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'primary';
    if (score >= 40) return 'info';
    return 'neutral';
  };

  if (loading && results.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} padding="md" className="animate-pulse">
            <div className="flex items-start justify-between mb-4">
              <Skeleton width="70%" height={24} />
              <Skeleton width={80} height={24} variant="rounded" />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Skeleton height={16} />
              <Skeleton height={16} />
              <Skeleton height={16} />
            </div>
            <Skeleton.Group count={2} />
          </Card>
        ))}
      </div>
    );
  }

  if (!loading && results.length === 0 && query) {
    return (
      <Card padding="lg" className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary-100 mb-4">
          <Search className="h-8 w-8 text-secondary-400" />
        </div>
        <h3 className="text-lg font-semibold text-secondary-900 mb-2">No contracts found</h3>
        <p className="text-secondary-500 max-w-md mx-auto">
          Try adjusting your search terms or filters to find relevant contracts.
        </p>
      </Card>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary-900">
            Search Results
          </h2>
          <p className="text-sm text-secondary-500">
            Found {pagination.total.toLocaleString()} contracts matching your query
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-secondary-500">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            Updating...
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((result, index) => {
          const matchScore = getMatchScore(result);
          return (
            <Card
              key={result.contract_id}
              padding="md"
              hover
              animate
              className="group"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/contracts/${result.contract_id}`}
                    className="text-lg font-medium text-secondary-900 hover:text-primary-600 transition-colors line-clamp-2 group-hover:text-primary-600"
                  >
                    {result.title}
                  </Link>
                </div>
                <Badge variant={getMatchVariant(matchScore) as any} size="md">
                  {matchScore}% match
                </Badge>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-secondary-600">
                  <Building2 className="h-4 w-4 text-secondary-400" />
                  <span className="truncate">{result.agency || 'Unknown Agency'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-secondary-600">
                  <DollarSign className="h-4 w-4 text-secondary-400" />
                  <span>
                    {Number.isFinite(result.estimated_value) && result.estimated_value > 0
                      ? `$${result.estimated_value.toLocaleString()}`
                      : 'Not specified'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-secondary-600">
                  <Calendar className="h-4 w-4 text-secondary-400" />
                  <span>{new Date(result.posted_date).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-secondary-600 line-clamp-2 mb-4">
                {result.description}
              </p>

              {/* Scores */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-secondary-500">
                  <Sparkles className="h-3.5 w-3.5 text-accent-500" />
                  <span>Semantic: {result.semanticScore || Math.round((result.semantic_score || 0) * 100)}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-secondary-500">
                  <TrendingUp className="h-3.5 w-3.5 text-primary-500" />
                  <span>Keyword: {result.keywordScore || Math.round((result.keyword_score || 0) * 100)}%</span>
                </div>
                {result.naics_code && (
                  <div className="flex items-center gap-1.5 text-xs text-secondary-500">
                    <Tag className="h-3.5 w-3.5 text-success-500" />
                    <span>NAICS: {result.naics_code}</span>
                  </div>
                )}
                <Link
                  to={`/contracts/${result.contract_id}`}
                  className="ml-auto flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  View Details
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(page) => onLoadMore('page', page)}
        />
      )}
    </div>
  );
};

export default SearchResults;
