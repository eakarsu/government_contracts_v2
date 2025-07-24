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
  Clock,
  HelpCircle,
  Info
} from 'lucide-react';
import LoadingSpinner from '../UI/LoadingSpinner';

const AIQuickActions: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [contractId, setContractId] = useState(() => {
    return localStorage.getItem('lastContractId') || '';
  });
  const [analysisType, setAnalysisType] = useState<'probability' | 'similarity' | 'strategy'>('probability');
  const [showHelp, setShowHelp] = useState<string | null>(null);
  const [validContractIds] = useState([
    'W9128F-24-R-0005',
    '47PA3024Q0068', 
    'W56KGY-24-R-0001',
    'FA8232-25-R-B013',
    'N00014-24-R-0123'
  ]);

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
    mutationFn: ({ id, analysisType }: { id: string, analysisType: string }) => 
      aiService.getComprehensiveAnalysis(id, 'current-user', undefined, analysisType),
    onSuccess: (data, variables) => {
      navigate(`/ai/analysis-results/${variables.id}?type=${variables.analysisType}`);
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
        comprehensiveAnalysisMutation.mutate({ id: contractId, analysisType });
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Contract ID for Analysis
            </label>
            <button
              onClick={() => setShowHelp(showHelp === 'contractId' ? null : 'contractId')}
              className="text-gray-400 hover:text-gray-600"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          
          {showHelp === 'contractId' && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
              <div className="font-medium text-blue-800 mb-1">💡 Contract ID Help</div>
              <div className="text-blue-700 space-y-1">
                <p>• Enter a government contract ID (like W9128F-24-R-0005)</p>
                <p>• Try these examples: {validContractIds.slice(0, 2).join(', ')}</p>
                <p>• AI will analyze requirements, competition, and your win probability</p>
              </div>
            </div>
          )}
          
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder="Enter contract ID (e.g., W9128F-24-R-0005)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          
          {!contractId && (
            <div className="mt-2 text-xs text-gray-500">
              💡 Try: {validContractIds.slice(0, 3).join(', ')}
            </div>
          )}
        </div>

        {/* Analysis Type Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Analysis Type
            </label>
            <button
              onClick={() => setShowHelp(showHelp === 'analysisType' ? null : 'analysisType')}
              className="text-gray-400 hover:text-gray-600"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          
          {showHelp === 'analysisType' && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
              <div className="font-medium text-blue-800 mb-2">📊 Analysis Types</div>
              <div className="text-blue-700 space-y-2">
                <div><strong>Win Probability:</strong> AI predicts your chances of winning based on company profile and contract requirements</div>
                <div><strong>Similar Contracts:</strong> Finds contracts similar to your target using AI matching algorithms</div>
                <div><strong>Bid Strategy:</strong> AI recommendations for pricing, team composition, and proposal focus areas</div>
              </div>
            </div>
          )}
          
          <select
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="probability">🎯 Win Probability Analysis</option>
            <option value="similarity">🔍 Similar Contracts Search</option>
            <option value="strategy">💡 Bid Strategy Optimization</option>
          </select>
        </div>

        {/* Quick Analysis Buttons */}
        <div className="grid grid-cols-1 gap-2">
          <div className="relative">
            <button
              onClick={() => handleAnalysis('comprehensive')}
              disabled={isLoading || !contractId.trim()}
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
            >
              {comprehensiveAnalysisMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  <span className="ml-2">🧠 AI analyzing contract requirements...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  🚀 Comprehensive AI Analysis
                </>
              )}
            </button>
            {showHelp === 'comprehensive' && (
              <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-purple-50 border border-purple-200 rounded-md text-sm z-10">
                <div className="font-medium text-purple-800 mb-1">🚀 Comprehensive Analysis</div>
                <div className="text-purple-700">
                  <p>• Combines all AI features in one report</p>
                  <p>• Win probability + similar contracts + bid strategy</p>
                  <p>• Takes 30-60 seconds to complete</p>
                  <p>• Best for serious bid opportunities</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setShowHelp(showHelp === 'comprehensive' ? null : 'comprehensive')}
              className="absolute top-1 right-1 text-white hover:text-gray-200"
            >
              <Info className="h-3 w-3" />
            </button>
          </div>

          <button
            onClick={() => handleAnalysis(analysisType)}
            disabled={isLoading || !contractId.trim()}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span className="ml-2">
                  {analysisType === 'probability' && '🎯 Calculating win probability...'}
                  {analysisType === 'similarity' && '🔍 Finding similar contracts...'}
                  {analysisType === 'strategy' && '💡 Optimizing bid strategy...'}
                </span>
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4 mr-2" />
                {analysisType === 'probability' && '🎯 Predict Win Probability'}
                {analysisType === 'similarity' && '🔍 Find Similar Contracts'}
                {analysisType === 'strategy' && '💡 Optimize Bid Strategy'}
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
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Lightbulb className="h-4 w-4 mr-1 text-yellow-500" />
            Quick Start Guide
          </h4>
          <div className="text-xs text-gray-600 space-y-2">
            <div className="p-2 bg-gray-50 rounded">
              <strong>Step 1:</strong> Enter a contract ID (try: {validContractIds[0]})
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <strong>Step 2:</strong> Choose analysis type or run comprehensive analysis
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <strong>Step 3:</strong> Review AI insights and recommendations
            </div>
          </div>
          
          <div className="mt-3 flex flex-wrap gap-1">
            {validContractIds.slice(0, 3).map((id) => (
              <button
                key={id}
                onClick={() => setContractId(id)}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Try {id}
              </button>
            ))}
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