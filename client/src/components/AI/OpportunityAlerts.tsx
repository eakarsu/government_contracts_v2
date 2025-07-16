import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, TrendingUp, Target, Bell } from 'lucide-react';

interface AIAlert {
  id: string;
  title: string;
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  opportunity: {
    id: string;
    title: string;
    agency: string;
    awardAmount: string;
    responseDeadline: string;
  };
  overallScore: number;
  winProbability: number;
  urgency: number;
  metadata: {
    estimatedTimeline: {
      daysUntilDeadline: number;
    };
    similarWins: any[];
    keyRequirements: string[];
  };
  actions: Array<{
    type: string;
    label: string;
    action: string;
  }>;
}

interface OpportunityAlertsProps {
  alerts: AIAlert[];
  loading?: boolean;
  onAlertAction?: (alert: AIAlert, action: string) => void;
}

const OpportunityAlerts: React.FC<OpportunityAlertsProps> = ({
  alerts,
  loading = false,
  onAlertAction
}) => {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const toggleExpand = (alertId: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return '$0';
    
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toLocaleString()}`;
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="mb-4 pb-4 border-b border-gray-200 last:border-0">
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No opportunity alerts at this time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">AI Opportunity Alerts</h3>
        <span className="text-sm text-gray-500">{alerts.length} alerts</span>
      </div>

      {alerts.map((alert) => {
        const isExpanded = expandedAlerts.has(alert.id);
        const daysRemaining = getDaysRemaining(alert.opportunity.responseDeadline);

        return (
          <div
            key={alert.id}
            className={`border-l-4 rounded-lg p-4 ${getPriorityColor(alert.priority)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {getPriorityIcon(alert.priority)}
                  <span className="text-sm font-medium capitalize">{alert.priority} Priority</span>
                </div>

                <h4 className="font-medium text-gray-900 mb-1">{alert.title}</h4>
                <p className="text-sm text-gray-600 mb-2">{alert.message}</p>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-gray-500">Agency:</span>
                    <span className="ml-1 text-gray-900">{alert.opportunity.agency}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Value:</span>
                    <span className="ml-1 text-gray-900 font-medium">
                      {formatCurrency(alert.opportunity.awardAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Win Prob:</span>
                    <span className="ml-1 text-gray-900">{alert.winProbability}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Deadline:</span>
                    <span className={`ml-1 font-medium ${getDaysColor(daysRemaining)}`}>
                      {daysRemaining} days
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => toggleExpand(alert.id)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>

                {isExpanded && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Contract Details</h5>
                      <p className="text-sm text-gray-600">{alert.opportunity.title}</p>
                    </div>

                    {alert.metadata.keyRequirements.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Key Requirements</h5>
                        <div className="flex flex-wrap gap-1">
                          {alert.metadata.keyRequirements.slice(0, 3).map((req, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {req}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {alert.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => onAlertAction?.(alert, action.action)}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end space-y-2">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">{alert.overallScore}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Overall Score
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OpportunityAlerts;