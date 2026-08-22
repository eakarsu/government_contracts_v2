import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, TrendingUp, Target, AlertCircle, Gauge, Clock } from 'lucide-react';
import { aiService } from '../../services/aiService';
import LoadingSpinner from '../UI/LoadingSpinner';

interface AIInsightsProps {
  userId?: string;
}

const AIInsights: React.FC<AIInsightsProps> = ({ userId }) => {
  // Fetch AI insights for dashboard overview
  const { data: opportunityPredictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ['opportunity-predictions', userId],
    queryFn: () => aiService.getOpportunityPredictions(),
    enabled: true,
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: aiHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['ai-health'],
    queryFn: () => aiService.checkAIServiceHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

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

  if (predictionsLoading || healthLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  const predictions = opportunityPredictions?.predictions || [];
  const summary = opportunityPredictions?.summary || {
    totalPredictions: 0,
    averageWinProbability: null,
    highProbability: 0,
    critical: 0,
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Brain className="h-5 w-5 mr-2 text-purple-600" />
            Opportunity Predictions
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
              <Target className="h-5 w-5 text-purple-600" />
              <span className="text-xs text-gray-500">Predictions</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalPredictions}
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-xs text-gray-500">Avg Win Probability</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.averageWinProbability == null ? 'N/A' : `${summary.averageWinProbability.toFixed(1)}%`}
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Gauge className="h-5 w-5 text-blue-600" />
              <span className="text-xs text-gray-500">High Probability</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.highProbability}
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <span className="text-xs text-gray-500">Critical Deadlines</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.critical}
            </div>
          </div>
        </div>

        <p className="mb-5 text-xs text-gray-500">
          Directional model estimates for open SAM.gov opportunities; they are not historical win outcomes.
        </p>

        {/* Top opportunity predictions */}
        {predictions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Top Predictions</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {predictions.slice(0, 5).map((prediction) => {
                const daysRemaining = getDaysRemaining(prediction.opportunity.responseDeadline);
                return (
                  <div
                    key={prediction.id}
                    className={`border rounded-lg p-3 ${getPriorityColor(prediction.priority)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 text-sm mb-1">{prediction.title}</h5>
                        <p className="text-xs text-gray-600 mb-2">{prediction.opportunity.agency}</p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span className={`font-medium ${getDaysColor(daysRemaining)}`}>
                            <Clock className="h-3 w-3 mr-1 inline" />
                            {daysRemaining} days
                          </span>
                          <span>Probability: {prediction.winProbability}%</span>
                          <span>Confidence: {prediction.confidence}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-700">
                          {prediction.priority}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {predictions.length > 5 && (
              <p className="mt-3 text-xs text-gray-500">
                Showing the 5 most urgent of {predictions.length} open-opportunity predictions.
              </p>
            )}
          </div>
        )}

        {predictions.length === 0 && (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No open opportunities to predict</p>
            <p className="text-xs text-gray-400 mt-1">Import current SAM.gov opportunities to populate predictions.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
