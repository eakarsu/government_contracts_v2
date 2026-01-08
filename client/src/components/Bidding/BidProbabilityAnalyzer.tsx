import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Target, BarChart3, Lightbulb, Trophy, AlertCircle, Search, RefreshCw,
  Sparkles, Building2, Calendar, ArrowLeft, ChevronLeft, ChevronRight,
  FileUp, FileCheck, Clock, PieChart, Shield, CheckCircle, XCircle, Upload,
  FileText, Users, DollarSign, AlertTriangle, Star, Download
} from 'lucide-react';
import { useAINavigation } from '../../contexts/AINavigationContext';

interface Contract {
  id: number;
  noticeId: string;
  title: string;
  agency: string;
  naicsCode?: string;
  contractValue?: number;
  postedDate?: string;
  description?: string;
}

interface BidPrediction {
  id: string;
  contractId: string;
  contractTitle?: string;
  agency?: string;
  probability: number;
  probabilityScore?: number;
  confidence?: string;
  confidenceLevel: number;
  factors: Array<{
    factor: string;
    impact: string;
    score: number;
    description: string;
    level?: string;
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
  };
  aiPowered?: boolean;
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

// New AI Feature Interfaces
interface DocumentAnalysis {
  requirements: Array<{ id: string; text: string; priority: string; category: string }>;
  evaluationCriteria: Array<{ criterion: string; weight: number; description: string }>;
  deadlines: Array<{ name: string; date: string; critical: boolean }>;
  certifications: string[];
  setAsides: string[];
  naicsCode: string;
  pscCode: string;
  pageLimit: number;
  formatRequirements: string[];
}

interface ProposalScore {
  overallScore: number;
  sections: Array<{
    name: string;
    score: number;
    maxScore: number;
    feedback: string;
    improvements: string[];
  }>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface ResourcePlan {
  totalHours: number;
  teamSize: number;
  timeline: Array<{ phase: string; duration: string; tasks: string[] }>;
  roles: Array<{ role: string; hours: number; rate: number }>;
  estimatedCost: number;
  goNoGo: { recommendation: string; confidence: number; factors: string[] };
}

interface MarketIntelligence {
  agencySpending: Array<{ year: number; amount: number }>;
  topCompetitors: Array<{ name: string; winRate: number; avgContractValue: number }>;
  naicsTrends: Array<{ naics: string; growth: number; opportunity: string }>;
  avgContractValue: number;
  competitionLevel: string;
  marketSize: number;
  recommendations: string[];
}

interface ComplianceCheck {
  overallStatus: string;
  score: number;
  checks: Array<{
    requirement: string;
    status: 'pass' | 'fail' | 'warning' | 'na';
    details: string;
    action?: string;
  }>;
  missingItems: string[];
  recommendations: string[];
}

const BidProbabilityAnalyzer: React.FC = () => {
  const navigate = useNavigate();
  const { setParentRoute } = useAINavigation();
  const [predictions, setPredictions] = useState<BidPrediction[]>([]);
  const [bidHistory, setBidHistory] = useState<BidHistory[]>([]);
  const [analytics, setAnalytics] = useState<BidAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('analyze');

  // Contract selection
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showContractList, setShowContractList] = useState(false);

  // Pagination
  const [contractPage, setContractPage] = useState(1);
  const [totalContracts, setTotalContracts] = useState(0);
  const contractsPerPage = 10;

  // New AI Features State
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);
  const [proposalScore, setProposalScore] = useState<ProposalScore | null>(null);
  const [resourcePlan, setResourcePlan] = useState<ResourcePlan | null>(null);
  const [marketIntel, setMarketIntel] = useState<MarketIntelligence | null>(null);
  const [complianceCheck, setComplianceCheck] = useState<ComplianceCheck | null>(null);

  // Feature loading states
  const [docAnalyzing, setDocAnalyzing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [analyzingMarket, setAnalyzingMarket] = useState(false);
  const [checkingCompliance, setCheckingCompliance] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Proposal text for scoring
  const [proposalText, setProposalText] = useState('');

  useEffect(() => {
    setParentRoute('/ai/bid-analyzer');
    loadInitialData();
  }, [setParentRoute]);

  useEffect(() => {
    loadContracts(contractPage);
  }, [contractPage]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadContracts(),
        loadPredictions(),
        loadBidHistory()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadContracts = async (page: number = 1) => {
    try {
      const offset = (page - 1) * contractsPerPage;
      const response = await fetch(`/api/bid-prediction/contracts?limit=${contractsPerPage}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        setTotalContracts(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load contracts:', error);
    }
  };

  const loadPredictions = async () => {
    try {
      const response = await fetch('/api/bid-prediction/predictions?limit=20');
      if (response.ok) {
        const data = await response.json();
        setPredictions(data.predictions || []);
      }
    } catch (error) {
      console.error('Failed to load predictions:', error);
    }
  };

  const loadBidHistory = async () => {
    try {
      const response = await fetch('/api/bid-prediction/history');
      if (response.ok) {
        const data = await response.json();
        setBidHistory(data.bidHistory || []);
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to load bid history:', error);
    }
  };

  const analyzeContract = async () => {
    if (!selectedContract) return;

    setAnalyzing(true);
    try {
      const response = await fetch('/api/bid-prediction/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: selectedContract.noticeId })
      });

      if (response.ok) {
        const data = await response.json();
        setPredictions([data.prediction, ...predictions]);
        setActiveTab('predictions');
      } else {
        const error = await response.json();
        alert(`Analysis failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze contract');
    } finally {
      setAnalyzing(false);
    }
  };

  const searchContracts = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      loadContracts();
      return;
    }

    try {
      const response = await fetch(`/api/bid-prediction/contracts?search=${encodeURIComponent(query)}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // ========== NEW AI FEATURE HANDLERS ==========

  // Document Analyzer
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setDocumentAnalysis(null);
    }
  };

  const analyzeDocument = async () => {
    if (!uploadedFile) return;
    setDocAnalyzing(true);
    setDocumentAnalysis(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/bid-prediction/analyze-document', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setDocumentAnalysis(data.analysis);
      } else {
        alert('Failed to analyze document');
      }
    } catch (error) {
      console.error('Document analysis error:', error);
      alert('Error analyzing document');
    } finally {
      setDocAnalyzing(false);
    }
  };

  // Proposal Scorer
  const scoreProposal = async () => {
    if (!proposalText.trim() || !selectedContract) return;
    setScoring(true);
    setProposalScore(null);

    try {
      const response = await fetch('/api/bid-prediction/score-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedContract.noticeId,
          proposalText: proposalText
        })
      });

      if (response.ok) {
        const data = await response.json();
        setProposalScore(data.score);
      } else {
        alert('Failed to score proposal');
      }
    } catch (error) {
      console.error('Scoring error:', error);
      alert('Error scoring proposal');
    } finally {
      setScoring(false);
    }
  };

  // Resource Planner
  const planResources = async () => {
    if (!selectedContract) return;
    setPlanning(true);
    setResourcePlan(null);

    try {
      const response = await fetch('/api/bid-prediction/plan-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: selectedContract.noticeId })
      });

      if (response.ok) {
        const data = await response.json();
        setResourcePlan(data.plan);
      } else {
        alert('Failed to generate resource plan');
      }
    } catch (error) {
      console.error('Resource planning error:', error);
      alert('Error generating resource plan');
    } finally {
      setPlanning(false);
    }
  };

  // Market Intelligence
  const analyzeMarket = async () => {
    if (!selectedContract) return;
    setAnalyzingMarket(true);
    setMarketIntel(null);

    try {
      const response = await fetch('/api/bid-prediction/market-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedContract.noticeId,
          naicsCode: selectedContract.naicsCode,
          agency: selectedContract.agency
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMarketIntel(data.intelligence);
      } else {
        alert('Failed to analyze market');
      }
    } catch (error) {
      console.error('Market analysis error:', error);
      alert('Error analyzing market');
    } finally {
      setAnalyzingMarket(false);
    }
  };

  // Compliance Checker
  const checkCompliance = async () => {
    if (!selectedContract) return;
    setCheckingCompliance(true);
    setComplianceCheck(null);

    try {
      const response = await fetch('/api/bid-prediction/check-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: selectedContract.noticeId })
      });

      if (response.ok) {
        const data = await response.json();
        setComplianceCheck(data.compliance);
      } else {
        alert('Failed to check compliance');
      }
    } catch (error) {
      console.error('Compliance check error:', error);
      alert('Error checking compliance');
    } finally {
      setCheckingCompliance(false);
    }
  };

  // ========== END NEW AI FEATURE HANDLERS ==========

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getProbabilityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const tabs = [
    { id: 'analyze', label: 'Win Probability', icon: Sparkles },
    { id: 'document', label: 'Document Analyzer', icon: FileUp },
    { id: 'scorer', label: 'Proposal Scorer', icon: FileCheck },
    { id: 'resources', label: 'Resource Planner', icon: Clock },
    { id: 'market', label: 'Market Intel', icon: PieChart },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'predictions', label: 'Predictions', icon: Target },
    { id: 'history', label: 'Bid History', icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading bid analyzer...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
          <Target className="h-7 w-7 text-blue-600" />
          Bid Probability Analyzer
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-powered bid success predictions using real contract data
        </p>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Bids</p>
                <p className="text-xl font-semibold text-gray-900">{analytics.totalBids}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-50">
                <Trophy className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Wins</p>
                <p className="text-xl font-semibold text-gray-900">{analytics.wonBids}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-50">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Win Rate</p>
                <p className="text-xl font-semibold text-gray-900">{analytics.winRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg Bid</p>
                <p className="text-xl font-semibold text-gray-900">
                  {formatCurrency(analytics.avgBidAmount)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">AI Accuracy</p>
                <p className="text-xl font-semibold text-gray-900">{analytics.predictionAccuracy}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-6 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          {/* Analyze Tab */}
          {activeTab === 'analyze' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  AI-Powered Contract Analysis
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Select a contract from your database to analyze win probability using OpenRouter AI.
                  The analysis considers contract requirements, your company profile, and historical data.
                </p>

                {/* Contract Search */}
                <div className="relative mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search contracts by title, ID, or agency..."
                      value={searchQuery}
                      onChange={(e) => searchContracts(e.target.value)}
                      onFocus={() => setShowContractList(true)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>

                  {/* Contract Dropdown */}
                  {showContractList && contracts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                      {contracts.map((contract) => (
                        <button
                          key={contract.noticeId}
                          onClick={() => {
                            setSelectedContract(contract);
                            setSearchQuery(contract.title || contract.noticeId);
                            setShowContractList(false);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 ${
                            selectedContract?.noticeId === contract.noticeId ? 'bg-blue-50' : ''
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {contract.title || 'Untitled Contract'}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {contract.agency?.split('.')[0] || 'Unknown Agency'}
                            </span>
                            {contract.postedDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(contract.postedDate)}
                              </span>
                            )}
                            <span className="text-gray-400">{contract.noticeId}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Contract */}
                {selectedContract && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{selectedContract.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedContract.agency} | {selectedContract.noticeId}
                        </p>
                        {selectedContract.contractValue && (
                          <p className="text-xs text-green-600 mt-1">
                            Value: {formatCurrency(selectedContract.contractValue)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedContract(null)}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}

                {/* Analyze Button */}
                <button
                  onClick={analyzeContract}
                  disabled={!selectedContract || analyzing}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Analyzing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze Win Probability
                    </>
                  )}
                </button>
              </div>

              {/* Contracts List with Pagination */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    Contracts ({totalContracts} total)
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Page {contractPage} of {Math.ceil(totalContracts / contractsPerPage) || 1}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {contracts.map((contract) => (
                    <button
                      key={contract.noticeId}
                      onClick={() => {
                        setSelectedContract(contract);
                        setSearchQuery(contract.title || contract.noticeId);
                      }}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        selectedContract?.noticeId === contract.noticeId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {contract.title || 'Untitled Contract'}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {contract.agency?.split('.')[0] || 'Unknown Agency'}
                            </span>
                            {contract.postedDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(contract.postedDate)}
                              </span>
                            )}
                          </div>
                        </div>
                        {contract.contractValue && (
                          <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                            {formatCurrency(contract.contractValue)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setContractPage(Math.max(1, contractPage - 1))}
                    disabled={contractPage === 1}
                    className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, Math.ceil(totalContracts / contractsPerPage)) }, (_, i) => {
                      const totalPages = Math.ceil(totalContracts / contractsPerPage);
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (contractPage <= 3) {
                        pageNum = i + 1;
                      } else if (contractPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = contractPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setContractPage(pageNum)}
                          className={`w-8 h-8 text-sm rounded-lg ${
                            contractPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setContractPage(Math.min(Math.ceil(totalContracts / contractsPerPage), contractPage + 1))}
                    disabled={contractPage >= Math.ceil(totalContracts / contractsPerPage)}
                    className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Document Analyzer Tab */}
          {activeTab === 'document' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-100">
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-purple-600" />
                  RFP Document Analyzer
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload an RFP document (PDF, DOCX, TXT) to extract requirements, evaluation criteria, and key information.
                </p>

                <div className="space-y-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.docx,.doc,.txt"
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                  >
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700">
                      {uploadedFile ? uploadedFile.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOCX, or TXT (max 10MB)</p>
                  </div>

                  {uploadedFile && (
                    <button
                      onClick={analyzeDocument}
                      disabled={docAnalyzing}
                      className="w-full px-4 py-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {docAnalyzing ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Analyzing document...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Analyze Document
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {documentAnalysis && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Key Requirements ({documentAnalysis.requirements.length})
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {documentAnalysis.requirements.map((req) => (
                          <div key={req.id} className="p-2 bg-gray-50 rounded text-sm">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${
                              req.priority === 'high' ? 'bg-red-100 text-red-700' :
                              req.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{req.priority}</span>
                            {req.text}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-600" />
                        Evaluation Criteria
                      </h4>
                      <div className="space-y-2">
                        {documentAnalysis.evaluationCriteria.map((criteria, idx) => (
                          <div key={idx} className="p-2 bg-gray-50 rounded">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{criteria.criterion}</span>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{criteria.weight}%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{criteria.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Deadlines</h4>
                      {documentAnalysis.deadlines.map((d, idx) => (
                        <div key={idx} className={`p-2 rounded mb-1 ${d.critical ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-xs text-gray-500">{d.date}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Certifications Required</h4>
                      <div className="flex flex-wrap gap-1">
                        {documentAnalysis.certifications.map((cert, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">{cert}</span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Set-Asides</h4>
                      <div className="flex flex-wrap gap-1">
                        {documentAnalysis.setAsides.map((sa, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">{sa}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proposal Scorer Tab */}
          {activeTab === 'scorer' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-100">
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-green-600" />
                  AI Proposal Scorer
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Paste your draft proposal to get an AI-powered score and improvement suggestions.
                </p>

                {!selectedContract ? (
                  <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Please select a contract first from the "Win Probability" tab
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-sm font-medium text-gray-900">{selectedContract.title}</p>
                      <p className="text-xs text-gray-500">{selectedContract.agency}</p>
                    </div>

                    <textarea
                      value={proposalText}
                      onChange={(e) => setProposalText(e.target.value)}
                      placeholder="Paste your proposal text here..."
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />

                    <button
                      onClick={scoreProposal}
                      disabled={!proposalText.trim() || scoring}
                      className="w-full px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {scoring ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Scoring proposal...
                        </>
                      ) : (
                        <>
                          <FileCheck className="h-4 w-4" />
                          Score My Proposal
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {proposalScore && (
                <div className="space-y-4">
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-lg font-medium text-gray-900">Overall Score</h4>
                      <div className={`text-4xl font-bold px-6 py-3 rounded-lg ${getProbabilityColor(proposalScore.overallScore)}`}>
                        {proposalScore.overallScore}/100
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {proposalScore.sections.map((section, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">{section.name}</span>
                            <span className="text-sm font-bold">{section.score}/{section.maxScore}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${(section.score / section.maxScore) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600">{section.feedback}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h5 className="text-sm font-medium text-green-800 mb-2">Strengths</h5>
                        <ul className="text-sm text-green-700 space-y-1">
                          {proposalScore.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                        </ul>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg">
                        <h5 className="text-sm font-medium text-red-800 mb-2">Areas to Improve</h5>
                        <ul className="text-sm text-red-700 space-y-1">
                          {proposalScore.weaknesses.map((w, i) => <li key={i}>• {w}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resource Planner Tab */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-100">
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Resource Planner
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Get AI-powered estimates for effort, timeline, team composition, and Go/No-Go recommendations.
                </p>

                {!selectedContract ? (
                  <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Please select a contract first from the "Win Probability" tab
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-sm font-medium text-gray-900">{selectedContract.title}</p>
                      <p className="text-xs text-gray-500">{selectedContract.agency}</p>
                    </div>

                    <button
                      onClick={planResources}
                      disabled={planning}
                      className="w-full px-4 py-3 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {planning ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Planning resources...
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4" />
                          Generate Resource Plan
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {resourcePlan && (
                <div className="space-y-4">
                  {/* Go/No-Go Recommendation */}
                  <div className={`p-6 rounded-lg border-2 ${
                    resourcePlan.goNoGo.recommendation === 'GO' ? 'bg-green-50 border-green-300' :
                    resourcePlan.goNoGo.recommendation === 'NO-GO' ? 'bg-red-50 border-red-300' :
                    'bg-yellow-50 border-yellow-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-bold">{resourcePlan.goNoGo.recommendation}</h4>
                        <p className="text-sm opacity-75">Confidence: {resourcePlan.goNoGo.confidence}%</p>
                      </div>
                      <div className={`text-5xl font-bold ${
                        resourcePlan.goNoGo.recommendation === 'GO' ? 'text-green-600' :
                        resourcePlan.goNoGo.recommendation === 'NO-GO' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {resourcePlan.goNoGo.recommendation === 'GO' ? '✓' : resourcePlan.goNoGo.recommendation === 'NO-GO' ? '✗' : '?'}
                      </div>
                    </div>
                    <div className="mt-3">
                      {resourcePlan.goNoGo.factors.map((f, i) => (
                        <span key={i} className="inline-block px-2 py-1 bg-white rounded text-xs mr-2 mb-1">{f}</span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border rounded-lg p-4 text-center">
                      <Clock className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{resourcePlan.totalHours}</p>
                      <p className="text-xs text-gray-500">Total Hours</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4 text-center">
                      <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{resourcePlan.teamSize}</p>
                      <p className="text-xs text-gray-500">Team Size</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4 text-center">
                      <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(resourcePlan.estimatedCost)}</p>
                      <p className="text-xs text-gray-500">Est. Cost</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4 text-center">
                      <Calendar className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{resourcePlan.timeline.length}</p>
                      <p className="text-xs text-gray-500">Phases</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Timeline</h4>
                      {resourcePlan.timeline.map((phase, idx) => (
                        <div key={idx} className="mb-3 p-3 bg-gray-50 rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">{phase.phase}</span>
                            <span className="text-xs text-gray-500">{phase.duration}</span>
                          </div>
                          <ul className="mt-1 text-xs text-gray-600">
                            {phase.tasks.map((t, i) => <li key={i}>• {t}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Team Composition</h4>
                      {resourcePlan.roles.map((role, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 border-b last:border-0">
                          <span className="text-sm">{role.role}</span>
                          <div className="text-right">
                            <p className="text-sm font-medium">{role.hours} hrs</p>
                            <p className="text-xs text-gray-500">${role.rate}/hr</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Market Intelligence Tab */}
          {activeTab === 'market' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-6 border border-indigo-100">
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-indigo-600" />
                  Market Intelligence
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Analyze agency spending trends, competition, and market opportunities.
                </p>

                {!selectedContract ? (
                  <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Please select a contract first from the "Win Probability" tab
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-sm font-medium text-gray-900">{selectedContract.title}</p>
                      <p className="text-xs text-gray-500">{selectedContract.agency} | NAICS: {selectedContract.naicsCode || 'N/A'}</p>
                    </div>

                    <button
                      onClick={analyzeMarket}
                      disabled={analyzingMarket}
                      className="w-full px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {analyzingMarket ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Analyzing market...
                        </>
                      ) : (
                        <>
                          <PieChart className="h-4 w-4" />
                          Analyze Market
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {marketIntel && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Market Size</p>
                      <p className="text-2xl font-bold text-indigo-600">{formatCurrency(marketIntel.marketSize)}</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Avg Contract Value</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(marketIntel.avgContractValue)}</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Competition Level</p>
                      <p className={`text-2xl font-bold ${
                        marketIntel.competitionLevel === 'Low' ? 'text-green-600' :
                        marketIntel.competitionLevel === 'Medium' ? 'text-yellow-600' : 'text-red-600'
                      }`}>{marketIntel.competitionLevel}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Top Competitors</h4>
                      <div className="space-y-2">
                        {marketIntel.topCompetitors.map((comp, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium">{comp.name}</span>
                            <div className="text-right">
                              <p className="text-xs text-green-600">{comp.winRate}% win rate</p>
                              <p className="text-xs text-gray-500">{formatCurrency(comp.avgContractValue)} avg</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Agency Spending Trend</h4>
                      <div className="space-y-2">
                        {marketIntel.agencySpending.map((year, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="text-sm">{year.year}</span>
                            <div className="flex-1 mx-3 bg-gray-200 rounded-full h-2">
                              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${(year.amount / Math.max(...marketIntel.agencySpending.map(y => y.amount))) * 100}%` }} />
                            </div>
                            <span className="text-sm font-medium">{formatCurrency(year.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Recommendations</h4>
                    <ul className="space-y-2">
                      {marketIntel.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-6 border border-teal-100">
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-teal-600" />
                  Compliance Checker
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Verify your eligibility and compliance with contract requirements.
                </p>

                {!selectedContract ? (
                  <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Please select a contract first from the "Win Probability" tab
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-sm font-medium text-gray-900">{selectedContract.title}</p>
                      <p className="text-xs text-gray-500">{selectedContract.agency}</p>
                    </div>

                    <button
                      onClick={checkCompliance}
                      disabled={checkingCompliance}
                      className="w-full px-4 py-3 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {checkingCompliance ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Checking compliance...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4" />
                          Check Compliance
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {complianceCheck && (
                <div className="space-y-4">
                  <div className={`p-6 rounded-lg border-2 ${
                    complianceCheck.score >= 80 ? 'bg-green-50 border-green-300' :
                    complianceCheck.score >= 60 ? 'bg-yellow-50 border-yellow-300' :
                    'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-bold">{complianceCheck.overallStatus}</h4>
                        <p className="text-sm opacity-75">Compliance Score</p>
                      </div>
                      <div className={`text-4xl font-bold ${
                        complianceCheck.score >= 80 ? 'text-green-600' :
                        complianceCheck.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {complianceCheck.score}%
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Compliance Checks</h4>
                    <div className="space-y-2">
                      {complianceCheck.checks.map((check, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                          {check.status === 'pass' ? (
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                          ) : check.status === 'fail' ? (
                            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                          ) : check.status === 'warning' ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-gray-300 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{check.requirement}</p>
                            <p className="text-xs text-gray-500">{check.details}</p>
                            {check.action && (
                              <p className="text-xs text-blue-600 mt-1">Action: {check.action}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {complianceCheck.missingItems.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-red-800 mb-2">Missing Items</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {complianceCheck.missingItems.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Predictions Tab */}
          {activeTab === 'predictions' && (
            <div className="space-y-6">
              {predictions.length > 0 ? (
                predictions.map((prediction) => (
                  <div key={prediction.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {prediction.contractTitle || prediction.contractId}
                        </h3>
                        <p className="text-sm text-gray-500">{prediction.agency}</p>
                        {prediction.aiPowered && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            <Sparkles className="h-3 w-3" />
                            AI Powered
                          </span>
                        )}
                      </div>
                      <div className="text-center">
                        <div className={`text-3xl font-bold px-6 py-3 rounded-lg ${getProbabilityColor(prediction.probability)}`}>
                          {Math.round(prediction.probability)}%
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Win Probability</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {prediction.confidence} confidence
                        </p>
                      </div>
                    </div>

                    {/* Factors */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Contributing Factors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(prediction.factors || []).map((factor, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900">{factor.factor}</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                factor.impact === 'positive' ? 'bg-green-100 text-green-700' :
                                factor.impact === 'negative' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {factor.impact}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">{factor.description}</p>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-600 h-1.5 rounded-full"
                                style={{ width: `${factor.score}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Recommendations</h4>
                      <div className="space-y-2">
                        {(prediction.recommendations || []).map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                            <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{rec.action}</p>
                              <p className="text-xs text-gray-600 mt-0.5">{rec.rationale}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Competitive Analysis */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Competitive Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Est. Competitors</p>
                          <p className="text-xl font-semibold text-gray-900">
                            {prediction.competitiveAnalysis?.estimated_competitors || 'N/A'}
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-2">Your Advantages</p>
                          <div className="flex flex-wrap gap-1">
                            {(prediction.competitiveAnalysis?.company_advantages || []).slice(0, 3).map((adv, i) => (
                              <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                {adv}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-2">Areas to Improve</p>
                          <div className="flex flex-wrap gap-1">
                            {(prediction.competitiveAnalysis?.potential_weaknesses || []).slice(0, 3).map((weak, i) => (
                              <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                                {weak}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Predictions Yet</h3>
                  <p className="text-gray-500 mb-4">
                    Select a contract and run AI analysis to see predictions.
                  </p>
                  <button
                    onClick={() => setActiveTab('analyze')}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    Analyze a Contract
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {bidHistory.length > 0 ? (
                bidHistory.map((bid) => (
                  <div key={bid.id} className="border border-gray-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{bid.contractTitle}</h3>
                        <p className="text-xs text-gray-500">{bid.agency}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        bid.actualResult ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {bid.outcome}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-xs text-gray-500">Contract Value</span>
                        <p className="font-medium">{formatCurrency(bid.contractValue)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Your Bid</span>
                        <p className="font-medium">{formatCurrency(bid.bidAmount)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Predicted Prob.</span>
                        <p className="font-medium">{Math.round(bid.winProbability * 100)}%</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Date</span>
                        <p className="font-medium">{formatDate(bid.recordedAt)}</p>
                      </div>
                    </div>

                    {bid.lessonsLearned && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600">
                          <strong>Notes:</strong> {bid.lessonsLearned}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>No bid history available yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Analytics</h3>
              <p className="text-gray-500">
                Detailed analytics and trend analysis will be available as you generate more predictions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BidProbabilityAnalyzer;
