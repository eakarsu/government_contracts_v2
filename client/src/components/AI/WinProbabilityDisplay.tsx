import React from 'react';
import { TrendingUp, Target, AlertCircle, Lightbulb } from 'lucide-react';

interface WinProbabilityDisplayProps {
  prediction: {
    probability: number;
    confidence: number;
    factors: string[];
    recommendations: string[];
  };
  loading?: boolean;
}

const WinProbabilityDisplay: React.FC<WinProbabilityDisplayProps> = ({ 
  prediction, 
  loading = false 
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProbabilityBg = (probability: number) => {
    if (probability >= 70) return 'bg-green-50';
    if (probability >= 50) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const getProgressColor = (probability: number) => {
    if (probability >= 70) return 'bg-green-500';
    if (probability >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`rounded-lg border p-6 ${getProbabilityBg(prediction.probability)}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Target className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Win Probability</h3>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${getProbabilityColor(prediction.probability)}`}>
            {prediction.probability}%
          </div>
          <div className="text-sm text-gray-600">
            {prediction.confidence}% confidence
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${getProgressColor(prediction.probability)}`}
            style={{ width: `${prediction.probability}%` }}
          ></div>
        </div>
      </div>

      {prediction.factors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Key Factors</h4>
          <div className="space-y-1">
            {prediction.factors.map((factor, index) => (
              <div key={index} className="flex items-start space-x-2">
                <TrendingUp className="h-4 w-4 text-gray-400 mt-0.5" />
                <span className="text-sm text-gray-600">{factor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {prediction.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
          <div className="space-y-2">
            {prediction.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-2">
                <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
                <span className="text-sm text-gray-600">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WinProbabilityDisplay;