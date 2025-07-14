import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, BarChart3, Lightbulb, Trophy, AlertCircle } from 'lucide-react';

interface BidPrediction {
  id: string;
  contractId: string;
  probability: number;
  probabilityScore?: number;
  confidence?: string;
  confidenceLevel: string;
  factors: Array<{
    factor: string;
    impact: string;
    score: number;
    weight?: number;
    description: string;
  }>;
  recommendations: Array<{
    priority: string;
    action: string;
    rationale: string;
  }>;
  competitiveAnalysis: {
    estimated_competitors: number;
    company_advantages: string[];
    potential_weaknesses: string[];
    market_position: string;
    // Backward compatibility fields
    estimatedCompetitors?: number;
    keyDifferentiators?: Array<{ name: string; level: string }>;
    threats?: Array<{ name: string; level: string }>;
  };
  predictedAt: string;
}

interface BidHistory {
  id: string;
  contractId: string;
  contractTitle: string;
  agency: string;
  contractValue: number;
  bidAmount: number;
  outcome: string;
  winProbability: number;
  actualResult: boolean;
  lessonsLearned: string;
  recordedAt: string;
}

interface BidAnalytics {
  totalBids: number;
  wonBids: number;
  winRate: number;
  avgBidAmount: number;
  predictionAccuracy: number;
}

const BidProbabilityAnalyzer: React.FC = () => {
  const [predictions, setPredictions] = useState<BidPrediction[]>([]);
  const [bidHistory, setBidHistory] = useState<BidHistory[]>([]);
  const [analytics, setAnalytics] = useState<BidAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('predictions');
  const [selectedContract, setSelectedContract] = useState<string>('');

  useEffect(() => {
    loadPredictions();
    loadBidHistory();
  }, []);

  const loadPredictions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/bid-prediction/predictions?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPredictions(data.predictions);
      }
    } catch (error) {
      console.error('Failed to load predictions:', error);
    }
  };

  const loadBidHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/bid-prediction/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBidHistory(data.bidHistory);
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to load bid history:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePrediction = async (contractId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/bid-prediction/predict/${contractId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPredictions([data.prediction, ...predictions]);
        alert('Bid prediction generated successfully!');
      } else {
        const error = await response.json();
        alert(`Prediction failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Prediction error:', error);
      alert('Prediction failed');
    }
  };

  const recordBidOutcome = async (contractId: string, outcome: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/bid-prediction/outcome/${contractId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(outcome)
      });

      if (response.ok) {
        loadBidHistory(); // Refresh history
        alert('Bid outcome recorded successfully!');
      }
    } catch (error) {
      console.error('Failed to record outcome:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getProbabilityColor = (score: number) => {
    // Handle both percentage (75) and decimal (0.75) formats
    const normalizedScore = score > 1 ? score / 100 : score;
    if (normalizedScore >= 0.8) return 'text-green-600 bg-green-100';
    if (normalizedScore >= 0.6) return 'text-blue-600 bg-blue-100';
    if (normalizedScore >= 0.4) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceColor = (level: string | number) => {
    const levelStr = String(level).toLowerCase();
    switch (levelStr) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const tabs = [
    { id: 'predictions', label: 'Bid Predictions', icon: Target },
    { id: 'history', label: 'Bid History', icon: BarChart3 },
    { id: 'analytics', label: 'Performance Analytics', icon: TrendingUp }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          <Target className="inline-block w-8 h-8 mr-2 text-blue-600" />
          Bid Probability Analyzer
        </h1>
        <p className="text-gray-600">
          AI-powered bid success predictions and performance analytics
        </p>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Bids</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalBids}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Wins</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.wonBids}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.winRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                <Target className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Bid</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(analytics.avgBidAmount)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-indigo-100 text-indigo-600">
                <Lightbulb className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">AI Accuracy</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.predictionAccuracy}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Predictions Tab */}
          {activeTab === 'predictions' && (
            <div className="space-y-6">
              {predictions.length > 0 ? (
                predictions.map((prediction) => (
                  <div key={prediction.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getProbabilityColor(prediction.probability || prediction.probabilityScore || 0)}`}>
                            {Math.round(prediction.probability || prediction.probabilityScore || 0)}%
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Win Probability</p>
                        </div>
                        <div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(prediction.confidence || prediction.confidenceLevel || 'medium')}`}>
                            {prediction.confidence || prediction.confidenceLevel || 'medium'} confidence
                          </span>
                          <p className="text-sm text-gray-600 mt-1">
                            Predicted: {formatDate(prediction.predictedAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contributing Factors */}
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-3">Contributing Factors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {prediction.factors.map((factor, index) => (
                          <div key={index} className="p-3 border border-gray-200 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-gray-900">{factor.factor}</span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                factor.impact === 'positive' ? 'bg-green-100 text-green-800' :
                                factor.impact === 'negative' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {factor.impact}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{factor.description}</p>
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${factor.score || 0}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Score: {Math.round(factor.score || 0)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-3">Recommendations</h4>
                      <div className="space-y-3">
                        {prediction.recommendations.map((rec, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                            <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{rec.action}</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                                  rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {rec.priority} priority
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{rec.rationale}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Competitive Analysis */}
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-3">Competitive Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-600">Estimated Competitors</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {prediction.competitiveAnalysis.estimated_competitors || prediction.competitiveAnalysis.estimatedCompetitors || 0}
                          </p>
                        </div>
                        <div className="p-3 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">Your Advantages</p>
                          <div className="space-y-1">
                            {(prediction.competitiveAnalysis.company_advantages || []).map((advantage, index) => (
                              <span key={index} className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs mr-1">
                                {advantage}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">Areas to Improve</p>
                          <div className="space-y-1">
                            {(prediction.competitiveAnalysis.potential_weaknesses || []).map((weakness, index) => (
                              <span key={index} className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs mr-1">
                                {weakness}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No bid predictions yet. Generate predictions for contracts you're interested in.
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {bidHistory.length > 0 ? (
                bidHistory.map((bid) => (
                  <div key={bid.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{bid.contractTitle}</h3>
                        <p className="text-sm text-gray-600">{bid.agency}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          bid.actualResult ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {bid.outcome}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-500">Contract Value:</span>
                        <p className="font-medium">{formatCurrency(bid.contractValue)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Your Bid:</span>
                        <p className="font-medium">{formatCurrency(bid.bidAmount)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Predicted Probability:</span>
                        <p className="font-medium">{Math.round(bid.winProbability * 100)}%</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Recorded:</span>
                        <p className="font-medium">{formatDate(bid.recordedAt)}</p>
                      </div>
                    </div>

                    {bid.lessonsLearned && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <strong>Lessons Learned:</strong> {bid.lessonsLearned}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No bid history recorded yet. Start tracking your bid outcomes to improve predictions.
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="text-center py-8 text-gray-500">
              Advanced analytics and insights coming soon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BidProbabilityAnalyzer;
