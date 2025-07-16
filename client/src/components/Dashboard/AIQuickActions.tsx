import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiService } from '../../services/aiService';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Target,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Search,
  Calculator,
  Clock
} from 'lucide-react';
import LoadingSpinner from '../UI/LoadingSpinner';

const AIQuickActions: React.FC = () => {
  const queryClient = useQueryClient();
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

  const isLoading = winProbabilityMutation.isPending || 
                   similarContractsMutation.isPending || 
                   bidStrategyMutation.isPending ||
                   comprehensiveAnalysisMutation.isPending;

  // Save contract ID whenever it changes
  useEffect(() => {
    if (contractId.trim()) {
      localStorage.setItem('lastContractId', contractId);
    }
  }, [contractId]);

  return (
    <div className="bg-white shadow rounded-lg p-6 h-fit">
      <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
        <Brain className="h-5 w-5 mr-2 text-purple-600" />
        AI Quick Actions
      </h3>

      <div className="space-y-4">
        {/* Contract ID Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contract ID for Analysis
          </label>
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder="Enter contract ID..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Analysis Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Analysis Type
          </label>
          <select
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="probability">Win Probability</option>
            <option value="similarity">Similar Contracts</option>
            <option value="strategy">Bid Strategy</option>
          </select>
        </div>

        {/* Quick Analysis Buttons */}
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => handleAnalysis('comprehensive')}
            disabled={isLoading || !contractId.trim()}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
          >
            {comprehensiveAnalysisMutation.isPending ? (
              <LoadingSpinner size="sm" color="white" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Comprehensive AI Analysis
              </>
            )}
          </button>

          <button
            onClick={() => handleAnalysis(analysisType)}
            disabled={isLoading || !contractId.trim()}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" color="white" />
            ) : (
              <>
                <Lightbulb className="h-4 w-4 mr-2" />
                {analysisType === 'probability' && 'Predict Win Probability'}
                {analysisType === 'similarity' && 'Find Similar Contracts'}
                {analysisType === 'strategy' && 'Optimize Bid Strategy'}
              </>
            )}
          </button>
        </div>

        {/* Quick AI Tools */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Quick AI Tools</h4>
          
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => {
                if (contractId.trim()) {
                  similarContractsMutation.mutate(contractId);
                }
              }}
              disabled={!contractId.trim()}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertCircle className="h-4 w-4 mr-2 text-orange-500" />
              View AI Opportunities
            </button>

            <button
              onClick={() => {
                if (contractId.trim()) {
                  bidStrategyMutation.mutate(contractId);
                }
              }}
              disabled={!contractId.trim()}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calculator className="h-4 w-4 mr-2 text-green-500" />
              Strategy Optimizer
            </button>

            <button
              onClick={() => {
                if (contractId.trim()) {
                  winProbabilityMutation.mutate(contractId);
                }
              }}
              disabled={!contractId.trim()}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
              AI Analytics
            </button>
          </div>
        </div>

        {/* AI Feature Examples */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Example Contract IDs</h4>
          <div className="text-xs text-gray-500 space-y-1">
            <div>• Use real contract IDs from your database</div>
            <div>• Try with: W9128F-24-R-0005, 47PA3024Q0068, or W56KGY-24-R-0001</div>
            <div>• Comprehensive analysis combines all AI features</div>
          </div>
        </div>

        {/* Status Messages */}
        {isLoading && (
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
            <div className="text-purple-800 text-sm">
              🧠 AI is analyzing your contract...
            </div>
          </div>
        )}

        {winProbabilityMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="text-green-800 text-sm">
              ✅ Win probability analysis complete!
            </div>
          </div>
        )}

        {similarContractsMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="text-green-800 text-sm">
              ✅ Similar contracts found!
            </div>
          </div>
        )}

        {bidStrategyMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="text-green-800 text-sm">
              ✅ Bid strategy optimization complete!
            </div>
          </div>
        )}

        {comprehensiveAnalysisMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="text-green-800 text-sm">
              ✅ Comprehensive AI analysis complete!
            </div>
          </div>
        )}

        {/* Error Messages */}
        {winProbabilityMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800 text-sm">
              Error: {winProbabilityMutation.error instanceof Error ? winProbabilityMutation.error.message : 'Unknown error'}
            </div>
          </div>
        )}

        {similarContractsMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800 text-sm">
              Error: {similarContractsMutation.error instanceof Error ? similarContractsMutation.error.message : 'Unknown error'}
            </div>
          </div>
        )}

        {bidStrategyMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800 text-sm">
              Error: {bidStrategyMutation.error instanceof Error ? bidStrategyMutation.error.message : 'Unknown error'}
            </div>
          </div>
        )}

        {comprehensiveAnalysisMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800 text-sm">
              Error: {comprehensiveAnalysisMutation.error instanceof Error ? comprehensiveAnalysisMutation.error.message : 'Unknown error'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIQuickActions;