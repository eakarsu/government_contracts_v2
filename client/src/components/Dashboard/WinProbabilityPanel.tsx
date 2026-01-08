import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Target, ChevronRight, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { contractsApi } from '../../services/contractsApi';
import { bidPredictionApi, WinProbabilityPrediction } from '../../services/bidPredictionApi';
import type { Contract } from '../../types';

const WinProbabilityPanel: React.FC = () => {
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [prediction, setPrediction] = useState<WinProbabilityPrediction | null>(null);

  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['recent-contracts-for-probability'],
    queryFn: () => contractsApi.getContracts(1, 5),
    staleTime: 60000,
  });

  const analyzeMutation = useMutation({
    mutationFn: (contract: Contract) => bidPredictionApi.analyzeBid({
      contractId: contract.noticeId,
      contractTitle: contract.title || 'Untitled Contract',
      agency: contract.agency || 'Unknown Agency',
    }),
    onSuccess: (data) => {
      setPrediction(data.prediction);
    },
  });

  const handleAnalyze = (contract: Contract) => {
    setSelectedContract(contract);
    setPrediction(null);
    analyzeMutation.mutate(contract);
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-600';
    if (probability >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getProbabilityBg = (probability: number) => {
    if (probability >= 70) return 'bg-green-50';
    if (probability >= 50) return 'bg-amber-50';
    return 'bg-red-50';
  };

  const contracts = (contractsData as any)?.contracts || (contractsData as any)?.data || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Target className="h-4 w-4 text-indigo-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Win Probability</h2>
        </div>
      </div>

      <div className="p-5">
        {/* Contract List */}
        <p className="text-xs text-gray-500 mb-3">Select a contract to analyze:</p>

        {contractsLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No contracts available</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {contracts.map((contract: Contract) => (
              <button
                key={contract.noticeId}
                onClick={() => handleAnalyze(contract)}
                disabled={analyzeMutation.isPending && selectedContract?.noticeId === contract.noticeId}
                className={`
                  w-full p-3 rounded-lg border text-left transition-all text-sm
                  ${selectedContract?.noticeId === contract.noticeId
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                  disabled:opacity-50
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 truncate pr-2">
                    {contract.title || 'Untitled'}
                  </span>
                  {analyzeMutation.isPending && selectedContract?.noticeId === contract.noticeId ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Analysis Results */}
        {prediction && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {/* Win Probability */}
            <div className={`p-4 rounded-lg ${getProbabilityBg(prediction.probability)} mb-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Win Probability</span>
                <span className="text-xs text-gray-500 capitalize">{prediction.confidence} confidence</span>
              </div>
              <p className={`text-3xl font-bold ${getProbabilityColor(prediction.probability)}`}>
                {prediction.probability}%
              </p>
              <div className="mt-2 bg-white/50 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    prediction.probability >= 70 ? 'bg-green-500' :
                    prediction.probability >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${prediction.probability}%` }}
                />
              </div>
            </div>

            {/* Key Factors */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Key Factors</p>
              {prediction.factors.slice(0, 3).map((factor, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    {factor.impact === 'positive' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : factor.impact === 'negative' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm text-gray-700">{factor.factor}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{factor.score}%</span>
                </div>
              ))}
            </div>

            {/* AI Badge */}
            {prediction.aiPowered && (
              <p className="mt-3 text-xs text-indigo-600 text-center">
                Powered by AI analysis
              </p>
            )}
          </div>
        )}

        {analyzeMutation.isError && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">Analysis failed. Try again.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WinProbabilityPanel;
