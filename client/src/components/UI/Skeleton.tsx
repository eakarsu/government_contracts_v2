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

Skeleton.Group = SkeletonGroup;
Skeleton.Card = SkeletonCard;
Skeleton.Table = SkeletonTable;

export default Skeleton;
