import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { aiService } from '../services/aiService';
import {
  Brain,
  Target,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Search,
  Calculator,
  Clock,
  ArrowLeft
} from 'lucide-react';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const AIQuickActionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [contractId, setContractId] = useState(() => {
    return localStorage.getItem('lastContractId') || '';
  });
  const [analysisType, setAnalysisType] = useState<'probability' | 'similarity' | 'strategy'>('probability');

  // Win Probability Analysis
  const winProbabilityMutation = useMutation({
    mutationFn: (id: string) => aiService.predictWinProbability(id),
    onSuccess: (data, variables) => {
      navigate(`/ai/win-probability/${variables}`);
    },
  });

  // Similar Contracts Analysis
  const similarContractsMutation = useMutation({
    mutationFn: (id: string) => aiService.findSimilarContracts(id, 5),
    onSuccess: (data, variables) => {
      navigate(`/ai/similar-contracts/${variables}`);
    },
  });

  // Bid Strategy Optimization
  const bidStrategyMutation = useMutation({
    mutationFn: (id: string) => aiService.optimizeBidStrategy(id),
    onSuccess: (data, variables) => {
      navigate(`/ai/bid-strategy/${variables}`);
    },
  });

  // Comprehensive Analysis
  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: (id: string) => aiService.getComprehensiveAnalysis(id, 'current-user'),
    onSuccess: (data, id) => {
      navigate(`/ai/analysis-results/${id}`);
    },
  });

  const handleAnalysis = (type: 'probability' | 'similarity' | 'strategy' | 'comprehensive') => {
    if (!contractId.trim()) return;
    
    // Save contract ID to localStorage for persistence
    localStorage.setItem('lastContractId', contractId);

    switch (type) {
      case 'probability':
        winProbabilityMutation.mutate(contractId);
        break;
      case 'similarity':
        similarContractsMutation.mutate(contractId);
        break;
      case 'strategy':
        bidStrategyMutation.mutate(contractId);
        break;
      case 'comprehensive':
        comprehensiveAnalysisMutation.mutate(contractId);
        break;
    }
  };

  // Save contract ID whenever it changes
  useEffect(() => {
    if (contractId.trim()) {
      localStorage.setItem('lastContractId', contractId);
    }
  }, [contractId]);

  const isLoading = winProbabilityMutation.isPending || 
                   similarContractsMutation.isPending || 
                   bidStrategyMutation.isPending ||
                   comprehensiveAnalysisMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AI Quick Actions
        </h1>
        <p className="text-gray-600">
          Use AI to analyze contracts, predict win probability, find similar contracts, and optimize your bidding strategy
        </p>
      </div>

      <div className="bg-white shadow-lg rounded-lg p-8">
        {/* Contract ID Input */}
        <div className="mb-6">
          <label className="block text-lg font-medium text-gray-900 mb-3">
            Contract ID for Analysis
          </label>
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder="Enter contract ID..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Analysis Type Selector */}
        <div className="mb-6">
          <label className="block text-lg font-medium text-gray-900 mb-3">
            Analysis Type
          </label>
          <select
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value as any)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="probability">Win Probability</option>
            <option value="similarity">Similar Contracts</option>
            <option value="strategy">Bid Strategy</option>
          </select>
        </div>

        {/* Quick Analysis Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => handleAnalysis('comprehensive')}
            disabled={isLoading || !contractId.trim()}
            className="w-full flex items-center justify-center px-6 py-4 border border-transparent rounded-lg shadow-lg text-lg font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
          >
            {comprehensiveAnalysisMutation.isPending ? (
              <LoadingSpinner size="sm" color="white" />
            ) : (
              <>
                <Brain className="h-6 w-6 mr-3" />
                Comprehensive AI Analysis
              </>
            )}
          </button>

          <button
            onClick={() => handleAnalysis(analysisType)}
            disabled={isLoading || !contractId.trim()}
            className="w-full flex items-center justify-center px-6 py-4 border border-transparent rounded-lg shadow-lg text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" color="white" />
            ) : (
              <>
                <Lightbulb className="h-6 w-6 mr-3" />
                {analysisType === 'probability' && 'Predict Win Probability'}
                {analysisType === 'similarity' && 'Find Similar Contracts'}
                {analysisType === 'strategy' && 'Optimize Bid Strategy'}
              </>
            )}
          </button>
        </div>

        {/* Quick AI Tools */}
        <div className="border-t pt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Quick AI Tools</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                if (contractId.trim()) {
                  similarContractsMutation.mutate(contractId);
                }
              }}
              disabled={!contractId.trim()}
              className="flex flex-col items-center justify-center p-6 border border-gray-300 rounded-lg shadow-sm text-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertCircle className="h-8 w-8 text-orange-500 mb-3" />
              <span className="font-medium text-gray-900">View AI Opportunities</span>
              <span className="text-sm text-gray-600 mt-1">Find opportunities in similar contracts</span>
            </button>

            <button
              onClick={() => {
                if (contractId.trim()) {
                  bidStrategyMutation.mutate(contractId);
                }
              }}
              disabled={!contractId.trim()}
              className="flex flex-col items-center justify-center p-6 border border-gray-300 rounded-lg shadow-sm text-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calculator className="h-8 w-8 text-green-500 mb-3" />
              <span className="font-medium text-gray-900">Strategy Optimizer</span>
              <span className="text-sm text-gray-600 mt-1">Optimize your bidding strategy</span>
            </button>

            <button
              onClick={() => {
                if (contractId.trim()) {
                  winProbabilityMutation.mutate(contractId);
                }
              }}
              disabled={!contractId.trim()}
              className="flex flex-col items-center justify-center p-6 border border-gray-300 rounded-lg shadow-sm text-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrendingUp className="h-8 w-8 text-blue-500 mb-3" />
              <span className="font-medium text-gray-900">AI Analytics</span>
              <span className="text-sm text-gray-600 mt-1">Get detailed AI-powered analytics</span>
            </button>
          </div>
        </div>

        {/* AI Feature Examples */}
        <div className="border-t pt-8 mt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Example Contract IDs</h3>
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="text-gray-700 space-y-3">
              <div>
                <strong>Use real contract IDs from your database:</strong>
              </div>
              <div className="text-sm text-gray-600">
                • Try with: <code className="bg-white px-2 py-1 rounded text-sm">W9128F-24-R-0005</code>
              </div>
              <div className="text-sm text-gray-600">
                • Try with: <code className="bg-white px-2 py-1 rounded text-sm">47PA3024Q0068</code>
              </div>
              <div className="text-sm text-gray-600">
                • Try with: <code className="bg-white px-2 py-1 rounded text-sm">W56KGY-24-R-0001</code>
              </div>
              <div className="text-sm text-gray-600">
                • Comprehensive analysis combines all AI features for maximum insight
              </div>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {isLoading && (
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="text-purple-800 text-center">
              🧠 AI is analyzing your contract...
            </div>
          </div>
        )}

        {winProbabilityMutation.isSuccess && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-green-800 text-center">
              ✅ Win probability analysis complete! Redirecting to results...
            </div>
          </div>
        )}

        {similarContractsMutation.isSuccess && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-green-800 text-center">
              ✅ Similar contracts found! Redirecting to results...
            </div>
          </div>
        )}

        {bidStrategyMutation.isSuccess && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-green-800 text-center">
              ✅ Bid strategy optimization complete! Redirecting to results...
            </div>
          </div>
        )}

        {comprehensiveAnalysisMutation.isSuccess && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-green-800 text-center">
              ✅ Comprehensive AI analysis complete! Redirecting to results...
            </div>
          </div>
        )}

        {/* Error Messages */}
        {winProbabilityMutation.error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800">
              Error: {winProbabilityMutation.error instanceof Error ? winProbabilityMutation.error.message : 'Unknown error'}
            </div>
          </div>
        )}

        {similarContractsMutation.error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800">
              Error: {similarContractsMutation.error instanceof Error ? similarContractsMutation.error.message : 'Unknown error'}
            </div>
          </div>
        )}

        {bidStrategyMutation.error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800">
              Error: {bidStrategyMutation.error instanceof Error ? bidStrategyMutation.error.message : 'Unknown error'}
            </div>
          </div>
        )}

        {comprehensiveAnalysisMutation.error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800">
              Error: {comprehensiveAnalysisMutation.error instanceof Error ? comprehensiveAnalysisMutation.error.message : 'Unknown error'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIQuickActionsPage;