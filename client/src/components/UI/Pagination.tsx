import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  showFirstLast?: boolean;
  showPageNumbers?: boolean;
  maxVisiblePages?: number;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  showFirstLast = true,
  showPageNumbers = true,
  maxVisiblePages = 5,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  const getVisiblePages = (): number[] => {
    const pages: number[] = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let start = Math.max(1, currentPage - halfVisible);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  const buttonBase = `
    inline-flex items-center justify-center
    min-w-[2.25rem] h-9 px-2
    text-sm font-medium rounded-lg
    transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
    disabled:opacity-40 disabled:cursor-not-allowed
  `;

  const buttonDefault = `
    ${buttonBase}
    text-secondary-600 hover:text-secondary-900
    hover:bg-secondary-100
  `;

  const buttonActive = `
    ${buttonBase}
    bg-primary-600 text-white
    hover:bg-primary-700
  `;

  const startItem = itemsPerPage ? (currentPage - 1) * itemsPerPage + 1 : null;
  const endItem = itemsPerPage && totalItems
    ? Math.min(currentPage * itemsPerPage, totalItems)
    : null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Items info */}
      {totalItems !== undefined && itemsPerPage && (
        <p className="text-sm text-secondary-600">
          Showing <span className="font-medium text-secondary-900">{startItem}</span> to{' '}
          <span className="font-medium text-secondary-900">{endItem}</span> of{' '}
          <span className="font-medium text-secondary-900">{totalItems}</span> results
        </p>
      )}

      {/* Pagination controls */}
      <nav className="flex items-center gap-1">
        {/* First page */}
        {showFirstLast && (
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={buttonDefault}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}

        {/* Previous page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={buttonDefault}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {showPageNumbers && (
          <>
            {visiblePages[0] > 1 && (
              <>
                <button onClick={() => onPageChange(1)} className={buttonDefault}>
                  1
                </button>
                {visiblePages[0] > 2 && (
                  <span className="px-2 text-secondary-400">...</span>
                )}
              </>
            )}

            {visiblePages.map((page) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={currentPage === page ? buttonActive : buttonDefault}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            ))}

            {visiblePages[visiblePages.length - 1] < totalPages && (
              <>
                {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                  <span className="px-2 text-secondary-400">...</span>
                )}
                <button onClick={() => onPageChange(totalPages)} className={buttonDefault}>
                  {totalPages}
                </button>
              </>
            )}
          </>
        )}

        {/* Next page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={buttonDefault}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last page */}
        {showFirstLast && (
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={buttonDefault}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
      </nav>
    </div>
  );
};

export default Pagination;
