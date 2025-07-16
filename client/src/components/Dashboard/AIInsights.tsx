import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Brain, TrendingUp, Target, AlertCircle, DollarSign, Clock } from 'lucide-react';
import { aiService } from '../../services/aiService';
import LoadingSpinner from '../UI/LoadingSpinner';

interface AIInsightsProps {
  userId?: string;
}

const AIInsights: React.FC<AIInsightsProps> = ({ userId }) => {
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const navigate = useNavigate();

  // Fetch AI insights for dashboard overview
  const { data: opportunityAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['opportunity-alerts', userId],
    queryFn: () => aiService.getOpportunityAlerts(userId || 'anonymous'),
    enabled: true,
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: aiHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['ai-health'],
    queryFn: () => aiService.checkAIServiceHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getDaysRemaining = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const getDaysColor = (days: number) => {
    if (days <= 3) return 'text-red-600';
    if (days <= 7) return 'text-orange-600';
    if (days <= 14) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (alertsLoading || healthLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  const alerts = opportunityAlerts?.alerts || [];
  const summary = opportunityAlerts?.summary || { totalAlerts: 0, totalValue: 0, averageWinProbability: 0 };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Brain className="h-5 w-5 mr-2 text-purple-600" />
            AI Insights & Opportunities
          </h3>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              aiHealth?.status === 'healthy' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {aiHealth?.status || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* AI Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <span className="text-xs text-gray-500">Total Value</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.totalValue)}
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Target className="h-5 w-5 text-green-600" />
              <span className="text-xs text-gray-500">Opportunities</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalAlerts}
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <span className="text-xs text-gray-500">Avg Win Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {(summary.averageWinProbability || 0).toFixed(1)}%
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <span className="text-xs text-gray-500">Critical</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {'critical' in summary ? summary.critical : 0}
            </div>
          </div>
        </div>

        {/* Recent AI Alerts */}
        {alerts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Recent AI Opportunities</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {alerts.slice(0, 5).map((alert) => {
                const daysRemaining = getDaysRemaining(alert.opportunity.responseDeadline);
                return (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-3 ${getPriorityColor(alert.priority)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 text-sm mb-1">{alert.title}</h5>
                        <p className="text-xs text-gray-600 mb-2">{alert.message}</p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span className="flex items-center">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {formatCurrency(parseFloat(alert.opportunity.awardAmount.replace(/[^0-9.]/g, '')))}
                          </span>
                          <span className={`font-medium ${getDaysColor(daysRemaining)}`}>
                            <Clock className="h-3 w-3 mr-1 inline" />
                            {daysRemaining} days
                          </span>
                          <span>Win: {alert.winProbability}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-700">
                          Score: {alert.overallScore}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {alerts.length > 5 && (
              <button
                onClick={() => navigate('/ai-opportunities')}
                className="mt-3 text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                View all {alerts.length} opportunities →
              </button>
            )}
          </div>
        )}

        {alerts.length === 0 && (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No AI insights available</p>
            <p className="text-xs text-gray-400 mt-1">Check back for AI-powered opportunities</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;