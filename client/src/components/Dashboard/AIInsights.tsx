import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  TrendingUp,
  Target,
  AlertCircle,
  DollarSign,
  Clock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import Card from '../UI/Card';
import Badge from '../UI/Badge';
import Skeleton from '../UI/Skeleton';

interface AIInsightsProps {
  userId?: string;
}

const AIInsights: React.FC<AIInsightsProps> = ({ userId }) => {
  const navigate = useNavigate();

  const { data: opportunityAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['opportunity-alerts', userId],
    queryFn: () => aiService.getOpportunityAlerts(userId || 'anonymous'),
    enabled: true,
    refetchInterval: 60000,
  });

  const { data: aiHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['ai-health'],
    queryFn: () => aiService.checkAIServiceHealth(),
    refetchInterval: 30000,
  });

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'neutral';
    }
  };

  const getDaysRemaining = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const getDaysColor = (days: number) => {
    if (days <= 3) return 'text-danger-600';
    if (days <= 7) return 'text-warning-600';
    if (days <= 14) return 'text-info-600';
    return 'text-success-600';
  };

  if (alertsLoading || healthLoading) {
    return (
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <Skeleton width={200} height={24} />
            <Skeleton width={80} height={24} variant="rounded" />
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={80} variant="rounded" />
            ))}
          </div>
          <Skeleton.Group count={3} className="mt-4" gap="gap-4" />
        </div>
      </Card>
    );
  }

  const alerts = opportunityAlerts?.alerts || [];
  const summary = opportunityAlerts?.summary || { totalAlerts: 0, totalValue: 0, averageWinProbability: 0 };

  const statCards = [
    {
      icon: TrendingUp,
      label: 'Total Value',
      value: formatCurrency(summary.totalValue),
      color: 'text-accent-600',
      bg: 'bg-accent-50',
    },
    {
      icon: Target,
      label: 'Opportunities',
      value: summary.totalAlerts.toString(),
      color: 'text-success-600',
      bg: 'bg-success-50',
    },
    {
      icon: DollarSign,
      label: 'Avg Win Rate',
      value: `${(summary.averageWinProbability || 0).toFixed(1)}%`,
      color: 'text-primary-600',
      bg: 'bg-primary-50',
    },
    {
      icon: AlertCircle,
      label: 'Critical',
      value: ('critical' in summary ? summary.critical : 0).toString(),
      color: 'text-warning-600',
      bg: 'bg-warning-50',
    },
  ];

  return (
    <Card padding="none">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-50">
              <Sparkles className="h-5 w-5 text-accent-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-secondary-900">
                AI Insights & Opportunities
              </h3>
              <p className="text-sm text-secondary-500">
                AI-powered contract recommendations
              </p>
            </div>
          </div>
          <Badge
            variant={aiHealth?.status === 'healthy' ? 'success' : 'danger'}
            dot
            pulse={aiHealth?.status === 'healthy'}
          >
            {aiHealth?.status === 'healthy' ? 'AI Online' : 'AI Offline'}
          </Badge>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat, i) => (
            <div
              key={i}
              className={`${stat.bg} rounded-xl p-4 transition-all duration-200 hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-xs font-medium text-secondary-500">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-secondary-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Alerts List */}
        {alerts.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-secondary-900 mb-3">
              Recent Opportunities
            </h4>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {alerts.slice(0, 5).map((alert) => {
                const daysRemaining = getDaysRemaining(alert.opportunity.responseDeadline);
                return (
                  <div
                    key={alert.id}
                    className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-secondary-50/50 transition-all duration-200 cursor-pointer"
                    onClick={() => navigate(`/contracts/${alert.opportunity.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getPriorityVariant(alert.priority) as any} size="sm">
                            {alert.priority}
                          </Badge>
                          <span className="text-xs text-secondary-500">
                            Score: {alert.overallScore}
                          </span>
                        </div>
                        <h5 className="font-medium text-secondary-900 text-sm truncate">
                          {alert.title}
                        </h5>
                        <p className="text-xs text-secondary-500 mt-1 line-clamp-1">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="flex items-center gap-1 text-secondary-600">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(parseFloat(alert.opportunity.awardAmount.replace(/[^0-9.]/g, '')))}
                          </span>
                          <span className={`flex items-center gap-1 font-medium ${getDaysColor(daysRemaining)}`}>
                            <Clock className="h-3 w-3" />
                            {daysRemaining} days left
                          </span>
                          <span className="text-success-600 font-medium">
                            {alert.winProbability}% win
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-secondary-400 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>

            {alerts.length > 5 && (
              <button
                onClick={() => navigate('/opportunities')}
                className="mt-4 w-full py-2.5 text-sm font-medium text-accent-600 hover:text-accent-700 hover:bg-accent-50 rounded-lg transition-colors"
              >
                View all {alerts.length} opportunities
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary-100 mb-4">
              <Brain className="h-6 w-6 text-secondary-400" />
            </div>
            <h4 className="text-sm font-medium text-secondary-900 mb-1">
              No AI insights available
            </h4>
            <p className="text-sm text-secondary-500">
              Check back for AI-powered opportunities
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AIInsights;
