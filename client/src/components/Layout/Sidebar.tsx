import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { aiService } from '../../services/aiService';
import { 
  Home, 
  Search, 
  FileText, 
  Briefcase, 
  Upload, 
  Settings, 
  BarChart3,
  X,
  Database,
  Zap,
  ClipboardList,
  Target,
  Wand2,
  Sparkles,
  Brain,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Calculator
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'NLP Search', href: '/nlp-search', icon: Sparkles },
  { name: 'RFP System', href: '/rfp', icon: ClipboardList },
  { name: 'Jobs', href: '/jobs', icon: BarChart3 },
  { name: 'Documents', href: '/documents', icon: Upload },
  { name: 'API Docs', href: '/api-docs', icon: Database },
];

const aiEnhancements = [
  { name: 'Proposal Drafter', href: '/ai/proposal-drafter', icon: Wand2 },
  { name: 'Bid Analyzer', href: '/ai/bid-analyzer', icon: Target },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // AI Quick Actions state
  const [contractId, setContractId] = useState(() => {
    return localStorage.getItem('lastContractId') || '';
  });
  const [analysisType, setAnalysisType] = useState<'probability' | 'similarity' | 'strategy'>('probability');

  // AI mutations
  const winProbabilityMutation = useMutation({
    mutationFn: (id: string) => aiService.predictWinProbability(id),
    onSuccess: (data, variables) => {
      navigate(`/ai/win-probability/${variables}`);
    },
  });

  const similarContractsMutation = useMutation({
    mutationFn: (id: string) => aiService.findSimilarContracts(id, 5),
    onSuccess: (data, variables) => {
      navigate(`/ai/similar-contracts/${variables}`);
    },
  });

  const bidStrategyMutation = useMutation({
    mutationFn: (id: string) => aiService.optimizeBidStrategy(id),
    onSuccess: (data, variables) => {
      navigate(`/ai/bid-strategy/${variables}`);
    },
  });

  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: (id: string) => aiService.getComprehensiveAnalysis(id, 'current-user'),
    onSuccess: (data, id) => {
      navigate(`/ai/analysis-results/${id}`);
    },
  });

  // Save contract ID to localStorage
  useEffect(() => {
    if (contractId.trim()) {
      localStorage.setItem('lastContractId', contractId);
    }
  }, [contractId]);

  const handleAnalysis = (type: 'probability' | 'similarity' | 'strategy' | 'comprehensive') => {
    if (!contractId.trim()) return;
    
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

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75" />
        </div>
      )}

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <Zap className="h-8 w-8 text-primary-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">
              ContractAI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href === '/rfp' && location.pathname.startsWith('/rfp'));
              return (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    onClick={onClose}
                    className={clsx(
                      'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                      isActive
                        ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <item.icon
                      className={clsx(
                        'mr-3 h-5 w-5 transition-colors duration-200',
                        isActive
                          ? 'text-primary-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      )}
                    />
                    {item.name}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* AI Quick Actions Section */}
          <div className="mt-6 px-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              AI Quick Actions
            </h3>
            
            {/* Contract ID Input */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Contract ID
              </label>
              <input
                type="text"
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                placeholder="Contract ID..."
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Analysis Type Selector */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Analysis Type
              </label>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value as any)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="probability">Win Probability</option>
                <option value="similarity">Similar Contracts</option>
                <option value="strategy">Bid Strategy</option>
              </select>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-2 mb-3">
              <button
                onClick={() => handleAnalysis('comprehensive')}
                disabled={isLoading || !contractId.trim()}
                className="w-full flex items-center justify-center px-2 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
              >
                <Brain className="h-3 w-3 mr-1" />
                Comprehensive AI
              </button>

              <button
                onClick={() => handleAnalysis(analysisType)}
                disabled={isLoading || !contractId.trim()}
                className="w-full flex items-center justify-center px-2 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                <Lightbulb className="h-3 w-3 mr-1" />
                Predict Win %
              </button>
            </div>

            {/* Quick AI Tools */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  if (contractId.trim()) {
                    similarContractsMutation.mutate(contractId);
                  }
                }}
                disabled={!contractId.trim()}
                className="w-full flex items-center justify-start px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertCircle className="h-3 w-3 mr-1.5 text-orange-500" />
                View AI Opportunities
              </button>

              <button
                onClick={() => {
                  if (contractId.trim()) {
                    bidStrategyMutation.mutate(contractId);
                  }
                }}
                disabled={!contractId.trim()}
                className="w-full flex items-center justify-start px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calculator className="h-3 w-3 mr-1.5 text-green-500" />
                Strategy Optimizer
              </button>

              <button
                onClick={() => {
                  if (contractId.trim()) {
                    winProbabilityMutation.mutate(contractId);
                  }
                }}
                disabled={!contractId.trim()}
                className="w-full flex items-center justify-start px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TrendingUp className="h-3 w-3 mr-1.5 text-blue-500" />
                AI Analytics
              </button>
            </div>

            {/* Example Contract IDs */}
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Examples: W9128F-24-R-0005, 47PA3024Q0068
              </div>
            </div>
          </div>

          {/* AI Enhancements Links */}
          <div className="mt-6">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI Enhancements
            </h3>
            <ul className="mt-2 space-y-1">
              {aiEnhancements.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith('/ai');
                return (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      onClick={onClose}
                      className={clsx(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                        isActive
                          ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <item.icon
                        className={clsx(
                          'mr-3 h-5 w-5 transition-colors duration-200',
                          isActive
                            ? 'text-blue-500'
                            : 'text-gray-400 group-hover:text-gray-500'
                        )}
                      />
                      {item.name}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            Government Contract Indexer
            <br />
            Powered by AI
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
