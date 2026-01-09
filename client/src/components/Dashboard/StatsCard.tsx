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
  gradient?: boolean;
  animationDelay?: number;
  onClick?: () => void;
  clickable?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'primary',
  subtitle,
  gradient = false,
  animationDelay = 0,
  onClick,
  clickable = false,
}) => {
  const variantStyles = {
    primary: {
      iconBg: gradient ? 'bg-white/20' : 'bg-primary-50',
      iconColor: gradient ? 'text-white' : 'text-primary-600',
      gradientBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      textColor: gradient ? 'text-white' : 'text-secondary-900',
      subtitleColor: gradient ? 'text-white/80' : 'text-secondary-500',
    },
    success: {
      iconBg: gradient ? 'bg-white/20' : 'bg-success-50',
      iconColor: gradient ? 'text-white' : 'text-success-600',
      gradientBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      textColor: gradient ? 'text-white' : 'text-secondary-900',
      subtitleColor: gradient ? 'text-white/80' : 'text-secondary-500',
    },
    warning: {
      iconBg: gradient ? 'bg-white/20' : 'bg-warning-50',
      iconColor: gradient ? 'text-white' : 'text-warning-600',
      gradientBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
      textColor: gradient ? 'text-white' : 'text-secondary-900',
      subtitleColor: gradient ? 'text-white/80' : 'text-secondary-500',
    },
    danger: {
      iconBg: gradient ? 'bg-white/20' : 'bg-danger-50',
      iconColor: gradient ? 'text-white' : 'text-danger-600',
      gradientBg: 'bg-gradient-to-br from-red-500 to-red-600',
      textColor: gradient ? 'text-white' : 'text-secondary-900',
      subtitleColor: gradient ? 'text-white/80' : 'text-secondary-500',
    },
    info: {
      iconBg: gradient ? 'bg-white/20' : 'bg-info-50',
      iconColor: gradient ? 'text-white' : 'text-info-600',
      gradientBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
      textColor: gradient ? 'text-white' : 'text-secondary-900',
      subtitleColor: gradient ? 'text-white/80' : 'text-secondary-500',
    },
    accent: {
      iconBg: gradient ? 'bg-white/20' : 'bg-accent-50',
      iconColor: gradient ? 'text-white' : 'text-accent-600',
      gradientBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      textColor: gradient ? 'text-white' : 'text-secondary-900',
      subtitleColor: gradient ? 'text-white/80' : 'text-secondary-500',
    },
    neutral: {
      iconBg: gradient ? 'bg-white/20' : 'bg-secondary-100',
      iconColor: gradient ? 'text-white' : 'text-secondary-600',
      gradientBg: 'bg-gradient-to-br from-gray-600 to-gray-700',
      textColor: gradient ? 'text-white' : 'text-secondary-900',
      subtitleColor: gradient ? 'text-white/80' : 'text-secondary-500',
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

  const isClickable = clickable || !!onClick;

  const baseClasses = `
    rounded-xl p-6 transition-all duration-300
    hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]
    animate-fade-in-up
    ${isClickable ? 'cursor-pointer' : ''}
  `;

  const cardClasses = gradient
    ? `${baseClasses} ${styles.gradientBg} shadow-lg`
    : `${baseClasses} bg-white border border-gray-100 shadow-card hover:shadow-card-hover`;

  return (
    <div
      className={cardClasses}
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium mb-1 ${styles.subtitleColor}`}>{title}</p>
          <p className={`text-2xl font-bold ${styles.textColor}`}>{formatValue(value)}</p>

          {trend && (
            <div className="flex items-center mt-2 gap-1">
              {trend.isPositive ? (
                <TrendingUp className={`h-4 w-4 ${gradient ? 'text-green-300' : 'text-success-500'}`} />
              ) : (
                <TrendingDown className={`h-4 w-4 ${gradient ? 'text-red-300' : 'text-danger-500'}`} />
              )}
              <span
                className={`text-sm font-medium ${
                  gradient
                    ? (trend.isPositive ? 'text-green-200' : 'text-red-200')
                    : (trend.isPositive ? 'text-success-600' : 'text-danger-600')
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className={`text-xs ${gradient ? 'text-white/60' : 'text-secondary-400'}`}>vs last period</span>
            </div>
          )}

          {subtitle && (
            <p className={`text-xs mt-2 ${styles.subtitleColor}`}>{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div className={`flex-shrink-0 p-3 rounded-xl ${styles.iconBg} backdrop-blur-sm`}>
            <Icon className={`h-6 w-6 ${styles.iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
