import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, FileText, Shield, AlertTriangle, DollarSign,
  MessageSquare, Target, Users, Tags, RefreshCw, Search, Building2,
  Calendar, ChevronLeft, ChevronRight, CheckCircle, XCircle, Send,
  TrendingUp, Lightbulb
} from 'lucide-react';

interface Contract {
  id: number;
  noticeId: string;
  title: string;
  agency: string;
  naicsCode?: string;
  contractValue?: number;
  postedDate?: string;
  description?: string;
  responseDeadline?: string;
}

interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const AICenter: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summarizer');

  // Contracts state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractPage, setContractPage] = useState(1);
  const [totalContracts, setTotalContracts] = useState(0);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const contractsPerPage = 8;

  // AI responses state
  const [aiLoading, setAiLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [complianceResult, setComplianceResult] = useState<any>(null);
  const [riskResult, setRiskResult] = useState<any>(null);
  const [priceResult, setPriceResult] = useState<any>(null);
  const [strategyResult, setStrategyResult] = useState<any>(null);
  const [teamingResult, setTeamingResult] = useState<any>(null);
  const [tagsResult, setTagsResult] = useState<any>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{role: string, content: string}>>([]);
  const [chatInput, setChatInput] = useState('');


  const tabs = [
    { id: 'summarizer', label: 'Summarizer', icon: FileText, color: 'blue' },
    { id: 'compliance', label: 'Compliance', icon: Shield, color: 'green' },
    { id: 'risk', label: 'Risk Assessment', icon: AlertTriangle, color: 'amber' },
    { id: 'pricing', label: 'Price Estimator', icon: DollarSign, color: 'emerald' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'purple' },
    { id: 'strategy', label: 'Capture Strategy', icon: Target, color: 'indigo' },
    { id: 'teaming', label: 'Teaming Partners', icon: Users, color: 'pink' },
    { id: 'tags', label: 'Auto-Tags', icon: Tags, color: 'cyan' },
  ];

  useEffect(() => {
    loadContracts(contractPage);
  }, [contractPage]);

  const loadContracts = async (page: number) => {
    setContractsLoading(true);
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
    } finally {
      setContractsLoading(false);
    }
  };

  const searchContracts = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      loadContracts(1);
      setContractPage(1);
      return;
    }
    setContractsLoading(true);
    try {
      const response = await fetch(`/api/bid-prediction/contracts?search=${encodeURIComponent(query)}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        setTotalContracts(data.total || 0);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setContractsLoading(false);
    }
  };

  const callAI = async (endpoint: string, body: any): Promise<AIResponse> => {
    try {
      const response = await fetch(`/api/ai-center/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to connect to AI service' };
    }
  };

  const handleSummarize = async () => {
    if (!selectedContract) return;
    setAiLoading(true);
    setSummaryResult(null);
    const result = await callAI('summarize', { contract: selectedContract });
    setSummaryResult(result);
    setAiLoading(false);
  };

  const handleComplianceCheck = async () => {
    if (!selectedContract) return;
    setAiLoading(true);
    setComplianceResult(null);
    const result = await callAI('compliance', { contract: selectedContract });
    setComplianceResult(result);
    setAiLoading(false);
  };

  const handleRiskAssessment = async () => {
    if (!selectedContract) return;
    setAiLoading(true);
    setRiskResult(null);
    const result = await callAI('risk', { contract: selectedContract });
    setRiskResult(result);
    setAiLoading(false);
  };

  const handlePriceEstimate = async () => {
    if (!selectedContract) return;
    setAiLoading(true);
    setPriceResult(null);
    const result = await callAI('pricing', { contract: selectedContract });
    setPriceResult(result);
    setAiLoading(false);
  };

  const handleCaptureStrategy = async () => {
    if (!selectedContract) return;
    setAiLoading(true);
    setStrategyResult(null);
    const result = await callAI('strategy', { contract: selectedContract });
    setStrategyResult(result);
    setAiLoading(false);
  };

  const handleTeamingPartners = async () => {
    if (!selectedContract) return;
    setAiLoading(true);
    setTeamingResult(null);
    const result = await callAI('teaming', { contract: selectedContract });
    setTeamingResult(result);
    setAiLoading(false);
  };

  const handleAutoTags = async () => {
    if (!selectedContract) return;
    setAiLoading(true);
    setTagsResult(null);
    const result = await callAI('tags', { contract: selectedContract });
    setTagsResult(result);
    setAiLoading(false);
  };

  const handleChat = async () => {
    if (!selectedContract || !chatInput.trim()) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);

    const result = await callAI('chat', {
      contract: selectedContract,
      message: userMessage,
      history: chatMessages
    });

    if (result.success && result.data?.response) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: result.data.response }]);
    } else {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
    setAiLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(value);
  };

  const totalPages = Math.ceil(totalContracts / contractsPerPage);

  const renderContractSelector = () => (
    <div className="bg-white rounded-lg border border-gray-200 h-full">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Select Contract</h3>
          <span className="text-xs text-gray-500">{totalContracts} total</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => searchContracts(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        {contractsLoading ? (
          <div className="p-6 text-center text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : contracts.map((contract) => (
          <div
            key={contract.noticeId}
            onClick={() => {
              setSelectedContract(contract);
              // Reset all results when new contract selected
              setSummaryResult(null);
              setComplianceResult(null);
              setRiskResult(null);
              setPriceResult(null);
              setStrategyResult(null);
              setTeamingResult(null);
              setTagsResult(null);
              setChatMessages([]);
            }}
            className={`px-4 py-3 cursor-pointer transition-colors ${
              selectedContract?.noticeId === contract.noticeId
                ? 'bg-blue-50 border-l-4 border-l-blue-500'
                : 'hover:bg-gray-50'
            }`}
          >
            <p className="text-sm font-medium text-gray-900 truncate">{contract.title || 'Untitled'}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{contract.agency?.split('.')[0]}</span>
            </div>
          </div>
        ))}
      </div>

      {!searchQuery && totalPages > 1 && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setContractPage(Math.max(1, contractPage - 1))}
            disabled={contractPage === 1}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-500">{contractPage} / {totalPages}</span>
          <button
            onClick={() => setContractPage(Math.min(totalPages, contractPage + 1))}
            disabled={contractPage >= totalPages}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  const renderSelectedContractInfo = () => {
    if (!selectedContract) return null;
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100 mb-4">
        <h4 className="font-medium text-gray-900 text-sm mb-1">{selectedContract.title}</h4>
        <p className="text-xs text-gray-500 mb-2">{selectedContract.agency}</p>
        <div className="flex flex-wrap gap-2">
          {selectedContract.naicsCode && (
            <span className="px-2 py-0.5 bg-white text-xs rounded border">NAICS: {selectedContract.naicsCode}</span>
          )}
          {selectedContract.postedDate && (
            <span className="px-2 py-0.5 bg-white text-xs rounded border flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(selectedContract.postedDate)}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderAIButton = (onClick: () => void, label: string, icon: React.ReactNode) => (
    <button
      onClick={onClick}
      disabled={!selectedContract || aiLoading}
      className="w-full px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {aiLoading ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Analyzing...
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );

  const renderTabContent = () => {
    if (!selectedContract) {
      return (
        <div className="text-center py-16 text-gray-500">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Select a contract from the left to use AI features</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'summarizer':
        return (
          <div className="space-y-4">
            {renderSelectedContractInfo()}
            {renderAIButton(handleSummarize, 'Generate Summary', <FileText className="h-4 w-4" />)}

            {summaryResult && (
              <div className="mt-6 space-y-4">
                {summaryResult.success ? (
                  <>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Executive Summary</h4>
                      <p className="text-sm text-gray-600">{summaryResult.data?.summary}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <h5 className="text-xs font-medium text-blue-800 mb-1">Key Requirements</h5>
                        <ul className="text-xs text-blue-700 space-y-1">
                          {summaryResult.data?.keyRequirements?.map((req: string, i: number) => (
                            <li key={i}>- {req}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <h5 className="text-xs font-medium text-green-800 mb-1">Eligibility</h5>
                        <ul className="text-xs text-green-700 space-y-1">
                          {summaryResult.data?.eligibility?.map((el: string, i: number) => (
                            <li key={i}>- {el}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <h5 className="text-xs font-medium text-amber-800 mb-1">Important Dates</h5>
                      <div className="text-xs text-amber-700">
                        {summaryResult.data?.dates?.map((date: any, i: number) => (
                          <p key={i}><strong>{date.label}:</strong> {date.value}</p>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">
                    {summaryResult.error || 'Failed to generate summary'}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'compliance':
        return (
          <div className="space-y-4">
            {renderSelectedContractInfo()}
            {renderAIButton(handleComplianceCheck, 'Check Compliance', <Shield className="h-4 w-4" />)}

            {complianceResult && (
              <div className="mt-6 space-y-4">
                {complianceResult.success ? (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className={`p-3 rounded-full ${
                        complianceResult.data?.overallScore >= 80 ? 'bg-green-100' :
                        complianceResult.data?.overallScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        <span className={`text-2xl font-bold ${
                          complianceResult.data?.overallScore >= 80 ? 'text-green-600' :
                          complianceResult.data?.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {complianceResult.data?.overallScore}%
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Compliance Score</h4>
                        <p className="text-sm text-gray-500">{complianceResult.data?.overallStatus}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {complianceResult.data?.checks?.map((check: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white border rounded-lg">
                          {check.passed ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{check.requirement}</p>
                            <p className="text-xs text-gray-500">{check.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {complianceResult.data?.gaps?.length > 0 && (
                      <div className="p-4 bg-amber-50 rounded-lg">
                        <h5 className="text-sm font-medium text-amber-800 mb-2">Gaps to Address</h5>
                        <ul className="text-sm text-amber-700 space-y-1">
                          {complianceResult.data?.gaps?.map((gap: string, i: number) => (
                            <li key={i}>- {gap}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">
                    {complianceResult.error || 'Failed to check compliance'}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'risk':
        return (
          <div className="space-y-4">
            {renderSelectedContractInfo()}
            {renderAIButton(handleRiskAssessment, 'Assess Risks', <AlertTriangle className="h-4 w-4" />)}

            {riskResult && (
              <div className="mt-6 space-y-4">
                {riskResult.success ? (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className={`px-4 py-2 rounded-lg ${
                        riskResult.data?.overallRisk === 'Low' ? 'bg-green-100 text-green-700' :
                        riskResult.data?.overallRisk === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        <span className="text-lg font-bold">{riskResult.data?.overallRisk}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Overall Risk Level</h4>
                        <p className="text-sm text-gray-500">Risk Score: {riskResult.data?.riskScore}/100</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {riskResult.data?.risks?.map((risk: any, i: number) => (
                        <div key={i} className={`p-4 rounded-lg border-l-4 ${
                          risk.level === 'High' ? 'bg-red-50 border-red-500' :
                          risk.level === 'Medium' ? 'bg-yellow-50 border-yellow-500' :
                          'bg-green-50 border-green-500'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-sm font-medium text-gray-900">{risk.category}</h5>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              risk.level === 'High' ? 'bg-red-200 text-red-800' :
                              risk.level === 'Medium' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-green-200 text-green-800'
                            }`}>{risk.level}</span>
                          </div>
                          <p className="text-sm text-gray-600">{risk.description}</p>
                          <p className="text-xs text-gray-500 mt-2"><strong>Mitigation:</strong> {risk.mitigation}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">
                    {riskResult.error || 'Failed to assess risks'}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'pricing':
        return (
          <div className="space-y-4">
            {renderSelectedContractInfo()}
            {renderAIButton(handlePriceEstimate, 'Estimate Price', <DollarSign className="h-4 w-4" />)}

            {priceResult && (
              <div className="mt-6 space-y-4">
                {priceResult.success ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500 mb-1">Low Estimate</p>
                        <p className="text-lg font-bold text-gray-700">{formatCurrency(priceResult.data?.lowEstimate || 0)}</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg text-center border-2 border-blue-200">
                        <p className="text-xs text-blue-600 mb-1">Recommended</p>
                        <p className="text-xl font-bold text-blue-700">{formatCurrency(priceResult.data?.recommendedPrice || 0)}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500 mb-1">High Estimate</p>
                        <p className="text-lg font-bold text-gray-700">{formatCurrency(priceResult.data?.highEstimate || 0)}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-900 mb-2">Pricing Rationale</h5>
                      <p className="text-sm text-gray-600">{priceResult.data?.rationale}</p>
                    </div>

                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <h5 className="text-sm font-medium text-indigo-800 mb-2">Market Analysis</h5>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-indigo-600">Competition Level</p>
                          <p className="font-medium text-indigo-900">{priceResult.data?.competitionLevel}</p>
                        </div>
                        <div>
                          <p className="text-xs text-indigo-600">Market Rate</p>
                          <p className="font-medium text-indigo-900">{priceResult.data?.marketRate}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">
                    {priceResult.error || 'Failed to estimate price'}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'chat':
        return (
          <div className="space-y-4">
            {renderSelectedContractInfo()}

            <div className="bg-gray-50 rounded-lg p-4 h-[350px] overflow-y-auto">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Ask questions about this contract</p>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-gray-400">Try asking:</p>
                    <button
                      onClick={() => setChatInput('What are the key requirements?')}
                      className="text-xs text-blue-600 hover:underline block mx-auto"
                    >
                      "What are the key requirements?"
                    </button>
                    <button
                      onClick={() => setChatInput('Who is eligible to bid?')}
                      className="text-xs text-blue-600 hover:underline block mx-auto"
                    >
                      "Who is eligible to bid?"
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-700'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 p-3 rounded-lg">
                        <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Ask about this contract..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleChat}
                disabled={!chatInput.trim() || aiLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case 'strategy':
        return (
          <div className="space-y-4">
            {renderSelectedContractInfo()}
            {renderAIButton(handleCaptureStrategy, 'Generate Strategy', <Target className="h-4 w-4" />)}

            {strategyResult && (
              <div className="mt-6 space-y-4">
                {strategyResult.success ? (
                  <>
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <h4 className="text-sm font-medium text-indigo-900 mb-2">Win Theme</h4>
                      <p className="text-sm text-indigo-700">{strategyResult.data?.winTheme}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h5 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" /> Strengths
                        </h5>
                        <ul className="text-xs text-green-700 space-y-1">
                          {strategyResult.data?.strengths?.map((s: string, i: number) => (
                            <li key={i}>- {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h5 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-1">
                          <Lightbulb className="h-4 w-4" /> Differentiators
                        </h5>
                        <ul className="text-xs text-blue-700 space-y-1">
                          {strategyResult.data?.differentiators?.map((d: string, i: number) => (
                            <li key={i}>- {d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-900 mb-2">Action Plan</h5>
                      <div className="space-y-2">
                        {strategyResult.data?.actionPlan?.map((action: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{action.step}</p>
                              <p className="text-xs text-gray-500">{action.timeline}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">
                    {strategyResult.error || 'Failed to generate strategy'}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'teaming':
        return (
          <div className="space-y-4">
            {renderSelectedContractInfo()}
            {renderAIButton(handleTeamingPartners, 'Find Partners', <Users className="h-4 w-4" />)}

            {teamingResult && (
              <div className="mt-6 space-y-4">
                {teamingResult.success ? (
                  <>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Capability Gaps</h4>
                      <div className="flex flex-wrap gap-2">
                        {teamingResult.data?.capabilityGaps?.map((gap: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded">
                            {gap}
                          </span>
                        ))}
                      </div>
                    </div>

                    <h5 className="text-sm font-medium text-gray-900">Recommended Partners</h5>
                    <div className="space-y-3">
                      {teamingResult.data?.partners?.map((partner: any, i: number) => (
                        <div key={i} className="p-4 bg-white border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h6 className="font-medium text-gray-900">{partner.type}</h6>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {partner.matchScore}% match
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{partner.reason}</p>
                          <div className="flex flex-wrap gap-1">
                            {partner.capabilities?.map((cap: string, j: number) => (
                              <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">
                    {teamingResult.error || 'Failed to find partners'}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'tags':
        return (
          <div className="space-y-4">
            {renderSelectedContractInfo()}
            {renderAIButton(handleAutoTags, 'Generate Tags', <Tags className="h-4 w-4" />)}

            {tagsResult && (
              <div className="mt-6 space-y-4">
                {tagsResult.success ? (
                  <>
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <h5 className="text-xs font-medium text-blue-800 mb-2">Industry</h5>
                        <div className="flex flex-wrap gap-1">
                          {tagsResult.data?.industry?.map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 rounded-lg">
                        <h5 className="text-xs font-medium text-green-800 mb-2">Contract Type</h5>
                        <div className="flex flex-wrap gap-1">
                          {tagsResult.data?.contractType?.map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-purple-50 rounded-lg">
                        <h5 className="text-xs font-medium text-purple-800 mb-2">Skills Required</h5>
                        <div className="flex flex-wrap gap-1">
                          {tagsResult.data?.skills?.map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50 rounded-lg">
                        <h5 className="text-xs font-medium text-amber-800 mb-2">Complexity & Fit</h5>
                        <div className="flex gap-3">
                          <div>
                            <p className="text-xs text-amber-600">Complexity</p>
                            <p className="font-medium text-amber-900">{tagsResult.data?.complexity}</p>
                          </div>
                          <div>
                            <p className="text-xs text-amber-600">Fit Score</p>
                            <p className="font-medium text-amber-900">{tagsResult.data?.fitScore}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">
                    {tagsResult.error || 'Failed to generate tags'}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">AI Center</h1>
            <p className="text-sm text-gray-500">All AI-powered features in one place</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6 overflow-x-auto">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Contract Selector */}
        <div className="lg:col-span-1">
          {renderContractSelector()}
        </div>

        {/* Right: AI Feature Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-5 min-h-[500px]">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICenter;
