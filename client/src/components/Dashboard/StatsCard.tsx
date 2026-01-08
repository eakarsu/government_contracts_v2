import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';
  subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'primary',
  subtitle,
}) => {
  const variantStyles = {
    primary: {
      iconBg: 'bg-primary-50',
      iconColor: 'text-primary-600',
    },
    success: {
      iconBg: 'bg-success-50',
      iconColor: 'text-success-600',
    },
    warning: {
      iconBg: 'bg-warning-50',
      iconColor: 'text-warning-600',
    },
    danger: {
      iconBg: 'bg-danger-50',
      iconColor: 'text-danger-600',
    },
    info: {
      iconBg: 'bg-info-50',
      iconColor: 'text-info-600',
    },
    accent: {
      iconBg: 'bg-accent-50',
      iconColor: 'text-accent-600',
    },
    neutral: {
      iconBg: 'bg-secondary-100',
      iconColor: 'text-secondary-600',
    },
  };

  const styles = variantStyles[variant];

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-secondary-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-secondary-900">{formatValue(value)}</p>

          {trend && (
            <div className="flex items-center mt-2 gap-1">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-success-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-danger-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-success-600' : 'text-danger-600'
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-secondary-400">vs last period</span>
            </div>
          )}

          {subtitle && (
            <p className="text-xs text-secondary-400 mt-2">{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div className={`flex-shrink-0 p-3 rounded-xl ${styles.iconBg}`}>
            <Icon className={`h-6 w-6 ${styles.iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
