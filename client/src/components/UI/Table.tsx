import React from 'react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  emptyMessage?: string;
  isLoading?: boolean;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
}

function Table<T>({
  columns,
  data,
  keyExtractor,
  striped = true,
  hoverable = true,
  compact = false,
  emptyMessage = 'No data available',
  isLoading = false,
  className = '',
  onRowClick,
}: TableProps<T>) {
  const cellPadding = compact ? 'px-4 py-2' : 'px-6 py-4';
  const headerPadding = compact ? 'px-4 py-2' : 'px-6 py-3';

  if (isLoading) {
    return (
      <div className={`overflow-hidden rounded-xl border border-gray-200 ${className}`}>
        <div className="animate-pulse">
          <div className="bg-secondary-50 h-12" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`h-16 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary-50/50'}`}>
              <div className="flex items-center h-full px-6 gap-4">
                {columns.map((_, j) => (
                  <div key={j} className="flex-1 h-4 bg-secondary-200 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-secondary-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`
                    ${headerPadding}
                    text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider
                    ${column.headerClassName || ''}
                  `.trim()}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-secondary-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={keyExtractor(item, index)}
                  className={`
                    transition-colors duration-150
                    ${striped && index % 2 === 1 ? 'bg-secondary-50/50' : ''}
                    ${hoverable ? 'hover:bg-primary-50/50' : ''}
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `.trim()}
                  onClick={() => onRowClick?.(item, index)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`
                        ${cellPadding}
                        text-sm text-secondary-900 whitespace-nowrap
                        ${column.className || ''}
                      `.trim()}
                    >
                      {column.render
                        ? column.render(item, index)
                        : (item as Record<string, unknown>)[column.key]?.toString() || '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
