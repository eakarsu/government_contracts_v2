import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'shimmer' | 'none';
}

interface SkeletonGroupProps {
  count: number;
  className?: string;
  gap?: string;
}

const Skeleton: React.FC<SkeletonProps> & {
  Group: React.FC<SkeletonGroupProps>;
  Card: React.FC<{ className?: string }>;
  Table: React.FC<{ rows?: number; columns?: number; className?: string }>;
  Dashboard: React.FC<{ className?: string }>;
  List: React.FC<{ count?: number; className?: string }>;
} = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-xl',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    shimmer: 'bg-gradient-to-r from-secondary-200 via-secondary-100 to-secondary-200 bg-[length:200%_100%] animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  return (
    <div
      className={`
        bg-secondary-200
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `.trim()}
      style={style}
    />
  );
};

const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  count,
  className = '',
  gap = 'gap-3',
}) => (
  <div className={`flex flex-col ${gap}`}>
    {[...Array(count)].map((_, i) => (
      <Skeleton key={i} className={className} />
    ))}
  </div>
);

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-100 p-6 ${className}`}>
    <div className="animate-pulse space-y-4">
      <Skeleton height={24} width="60%" />
      <Skeleton height={16} />
      <Skeleton height={16} width="80%" />
      <div className="flex gap-2 pt-2">
        <Skeleton height={32} width={80} variant="rounded" />
        <Skeleton height={32} width={80} variant="rounded" />
      </div>
    </div>
  </div>
);

const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => (
  <div className={`overflow-hidden rounded-xl border border-gray-200 ${className}`}>
    <div className="animate-pulse">
      <div className="bg-secondary-50 h-12 flex items-center px-6 gap-4">
        {[...Array(columns)].map((_, i) => (
          <div key={i} className="flex-1 h-4 bg-secondary-300 rounded" />
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          className={`h-16 flex items-center px-6 gap-4 ${
            i % 2 === 0 ? 'bg-white' : 'bg-secondary-50/50'
          }`}
        >
          {[...Array(columns)].map((_, j) => (
            <div key={j} className="flex-1 h-4 bg-secondary-200 rounded" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const SkeletonDashboard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`space-y-6 ${className}`}>
    {/* Stats Row */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
          <Skeleton height={16} width="50%" className="mb-3" />
          <Skeleton height={32} width="70%" className="mb-2" />
          <Skeleton height={12} width="40%" />
        </div>
      ))}
    </div>
    {/* Content Area */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <SkeletonCard />
      </div>
      <div>
        <SkeletonCard />
      </div>
    </div>
  </div>
);

const SkeletonList: React.FC<{ count?: number; className?: string }> = ({
  count = 5,
  className = '',
}) => (
  <div className={`space-y-3 ${className}`}>
    {[...Array(count)].map((_, i) => (
      <div key={i} className="bg-white rounded-lg p-4 animate-pulse flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="60%" />
          <Skeleton height={12} width="40%" />
        </div>
        <Skeleton height={32} width={80} variant="rounded" />
      </div>
    ))}
  </div>
);

Skeleton.Group = SkeletonGroup;
Skeleton.Card = SkeletonCard;
Skeleton.Table = SkeletonTable;
Skeleton.Dashboard = SkeletonDashboard;
Skeleton.List = SkeletonList;

export default Skeleton;
