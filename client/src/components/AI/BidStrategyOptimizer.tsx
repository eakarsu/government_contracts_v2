import React, { useState } from 'react';
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react';

interface BidStrategy {
  pricingStrategy: {
    recommendedPrice: number;
    priceRange: {
      conservative: number;
      aggressive: number;
    };
    pricingJustification: string[];
    profitMargin: number;
  };
  competitionAnalysis: {
    estimatedBidders: number;
    bidderRange: {
      min: number;
      max: number;
    };
    competitiveIntensity: number;
  };
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
    action: string;
  }>;
  executionPlan: {
    phases: Array<{
      name: string;
      duration: number;
      tasks: string[];
      dependencies: string[];
    }>;
    resourceAllocation: {
      estimatedHours: number;
      teamSize: number;
      keyRoles: string[];
    };
  };
  riskAssessment: Array<{
    category: string;
    level: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    mitigation: string;
  }>;
}

interface BidStrategyOptimizerProps {
  strategy: BidStrategy;
  loading?: boolean;
  onRecommendationAction?: (recommendation: any, action: string) => void;
}

const BidStrategyOptimizer: React.FC<BidStrategyOptimizerProps> = ({
  strategy,
  loading = false,
  onRecommendationAction
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'timeline' | 'risks'>('overview');

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 border-red-200';
      case 'high': return 'text-orange-600 border-orange-200';
      case 'medium': return 'text-yellow-600 border-yellow-200';
      default: return 'text-green-600 border-green-200';
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const calculateTimelineProgress = () => {
    const phases = strategy.executionPlan.phases;
    const totalDuration = phases.reduce((sum, phase) => sum + phase.duration, 0);
    const completedDuration = 0; // This would be calculated based on actual progress
    return (completedDuration / totalDuration) * 100;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'risks', label: 'Risks', icon: AlertTriangle }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="border-b border-gray-200">
        <div className="flex space-x-1 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-5 w-5 text-gray-600" />
                  <span className="text-sm text-gray-500">Competition</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {strategy.competitionAnalysis.estimatedBidders}
                </div>
                <div className="text-xs text-gray-600">
                  {strategy.competitionAnalysis.bidderRange.min}-{strategy.competitionAnalysis.bidderRange.max} range
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="h-5 w-5 text-gray-600" />
                  <span className="text-sm text-gray-500">Recommended Price</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(strategy.pricingStrategy.recommendedPrice)}
                </div>
                <div className="text-xs text-gray-600">
                  {strategy.pricingStrategy.profitMargin.toFixed(1)}% margin
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <span className="text-sm text-gray-500">Timeline</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {strategy.executionPlan.phases.reduce((sum, phase) => sum + phase.duration, 0)}d
                </div>
                <div className="text-xs text-gray-600">
                  {strategy.executionPlan.resourceAllocation.estimatedHours}h effort
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Strategic Recommendations</h4>
              <div className="space-y-3">
                {strategy.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${getImpactColor(rec.impact)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 mb-1">{rec.title}</h5>
                        <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium capitalize">{rec.impact} Impact</span>
                          <span className="text-xs text-gray-500">{rec.type}</span>
                        </div>
                      </div>
                      {onRecommendationAction && (
                        <button
                          onClick={() => onRecommendationAction(rec, rec.action)}
                          className="text-sm bg-white border border-gray-300 rounded-md px-3 py-1 hover:bg-gray-50"
                        >
                          Action
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-900 mb-2">
                  {formatCurrency(strategy.pricingStrategy.recommendedPrice)}
                </div>
                <p className="text-blue-700">Recommended Bid Price</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">Conservative Range</h5>
                <div className="text-lg font-bold text-green-600">
                  {formatCurrency(strategy.pricingStrategy.priceRange.conservative)}
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">Aggressive Range</h5>
                <div className="text-lg font-bold text-red-600">
                  {formatCurrency(strategy.pricingStrategy.priceRange.aggressive)}
                </div>
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">Pricing Justification</h5>
              <ul className="space-y-1">
                {strategy.pricingStrategy.pricingJustification.map((justification, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    • {justification}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Profit Margin Analysis</h5>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Estimated Profit Margin</span>
                <span className="text-lg font-bold text-green-600">
                  {strategy.pricingStrategy.profitMargin.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Resource Allocation</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Estimated Hours:</span>
                  <div className="font-medium">{strategy.executionPlan.resourceAllocation.estimatedHours}h</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Team Size:</span>
                  <div className="font-medium">{strategy.executionPlan.resourceAllocation.teamSize} people</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Key Roles:</span>
                  <div className="text-xs">
                    {strategy.executionPlan.resourceAllocation.keyRoles.join(', ')}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-3">Project Timeline</h5>
              <div className="space-y-4">
                {strategy.executionPlan.phases.map((phase, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2"
                    >
                      <h6 className="font-medium text-gray-900">{phase.name}</h6>
                      <span className="text-sm text-gray-500">{phase.duration} days</span>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1"
                    >
                      {phase.tasks.map((task, taskIndex) => (
                        <li key={taskIndex}>• {task}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="space-y-4">
            {strategy.riskAssessment.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-600">No significant risks identified</p>
              </div>
            ) : (
              strategy.riskAssessment.map((risk, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${getRiskColor(risk.level)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h6 className="font-medium text-gray-900 capitalize">{risk.category} Risk</h6>
                      <span className="text-sm font-medium capitalize">{risk.level} Priority</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{risk.description}</p>
                  <div className="bg-white bg-opacity-50 rounded p-2"
                  >
                    <p className="text-xs font-medium text-gray-700 mb-1">Mitigation:</p>
                    <p className="text-xs text-gray-600">{risk.mitigation}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BidStrategyOptimizer;