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
    <div className="bg-white rounded-xl border border-gray-100 shadow-card h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm">
            <Target className="h-4 w-4 text-white" />
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
                  w-full p-3 rounded-xl border text-left transition-all duration-200 text-sm group
                  ${selectedContract?.noticeId === contract.noticeId
                    ? 'border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-sm'
                    : 'border-gray-200 hover:border-indigo-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-indigo-50/30'
                  }
                  disabled:opacity-50
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`truncate pr-2 ${selectedContract?.noticeId === contract.noticeId ? 'text-indigo-700 font-medium' : 'text-gray-700 group-hover:text-gray-900'}`}>
                    {contract.title || 'Untitled'}
                  </span>
                  {analyzeMutation.isPending && selectedContract?.noticeId === contract.noticeId ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform ${selectedContract?.noticeId === contract.noticeId ? 'text-indigo-500' : 'text-gray-400 group-hover:translate-x-0.5'}`} />
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
            <div className={`p-4 rounded-xl ${getProbabilityBg(prediction.probability)} mb-4 border ${
              prediction.probability >= 70 ? 'border-green-200' :
              prediction.probability >= 50 ? 'border-amber-200' : 'border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Win Probability</span>
                <span className="text-xs px-2 py-0.5 bg-white/70 rounded-full text-gray-600 capitalize">{prediction.confidence} confidence</span>
              </div>
              <p className={`text-4xl font-bold ${getProbabilityColor(prediction.probability)}`}>
                {prediction.probability}%
              </p>
              <div className="mt-3 bg-white/60 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    prediction.probability >= 70 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                    prediction.probability >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-rose-500'
                  }`}
                  style={{ width: `${prediction.probability}%` }}
                />
              </div>
            </div>

            {/* Key Factors */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Key Factors</p>
              {prediction.factors.slice(0, 3).map((factor, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    {factor.impact === 'positive' ? (
                      <div className="p-1 bg-green-100 rounded-full">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      </div>
                    ) : factor.impact === 'negative' ? (
                      <div className="p-1 bg-red-100 rounded-full">
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                      </div>
                    ) : (
                      <div className="p-1 bg-amber-100 rounded-full">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                    )}
                    <span className="text-sm text-gray-700">{factor.factor}</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    factor.score >= 70 ? 'text-green-600' :
                    factor.score >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>{factor.score}%</span>
                </div>
              ))}
            </div>

            {/* AI Badge */}
            {prediction.aiPowered && (
              <div className="mt-4 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                <p className="text-xs font-medium text-indigo-600">
                  Powered by AI analysis
                </p>
              </div>
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
