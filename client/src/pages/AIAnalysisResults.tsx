import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Target, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useAINavigation } from '../contexts/AINavigationContext';

interface AnalysisData {
  contract: {
    id: string;
    title: string;
    agency: string;
    naicsCode: string | null;
    postedDate: string;
    awardAmount?: string;
    responseDeadline?: string;
  };
  winProbability?: {
    probability: number;
    confidence: number;
    factors: string[];
    recommendations: string[];
  };
  similarContracts?: {
    matches: any[];
    summary: any;
    insights: any[];
  };
  bidStrategy?: {
    pricingStrategy: any;
    competitionAnalysis: any;
    recommendations: any[];
    executionPlan: any;
    riskAssessment: any[];
    successMetrics: any;
  };
  opportunities?: any[];
  overallRecommendation?: {
    action: string;
    confidence: string;
    reasoning: string;
    priority: string;
  };
}

interface ComprehensiveAnalysis {
  contract: {
    id: string;
    title: string;
    agency: string;
    naicsCode: string | null;
    postedDate: string;
    awardAmount?: string;
    responseDeadline?: string;
  };
  winProbability: {
    probability: number;
    confidence: number;
    factors: string[];
    recommendations: string[];
  };
  similarContracts: {
    matches: any[];
    summary: any;
    insights: any[];
  };
  opportunities: any[];
  bidStrategy: {
    pricingStrategy: any;
    competitionAnalysis: any;
    recommendations: any[];
    executionPlan: any;
    riskAssessment: any[];
    successMetrics: any;
  };
  overallRecommendation: {
    action: string;
    confidence: string;
    reasoning: string;
    priority: string;
  };
}

interface AIAnalysisResultsProps {
  type?: string;
}

const AIAnalysisResults: React.FC<AIAnalysisResultsProps> = ({ type = 'comprehensive' }) => {
  const navigate = useNavigate();
  const { contractId } = useParams();
  const [searchParams] = useSearchParams();
  const { getBackNavigation } = useAINavigation();
  
  // Get analysis type from URL query param or fallback to prop
  const analysisType = searchParams.get('type') || type || 'comprehensive';
  const [analysis, setAnalysis] = useState<AnalysisData | ComprehensiveAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backNavigation = getBackNavigation();

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!contractId) {
        setError('No contract ID provided');
        setLoading(false);
        return;
      }

      const currentAnalysisType = analysisType;
      
      try {
        console.log(`Fetching ${currentAnalysisType} analysis for contract:`, contractId);
        
        let endpoint, data;
        const userContext = {
          companyProfile: {
            annualRevenue: 5000000,
            certifications: ['8(a)', 'HUBZone'],
            experienceInNaics: ['541511', '541512'],
            agencyRelationships: ['DoD', 'DHS'],
            hasBonding: true
          },
          preferences: {
            minContractValue: 50000,
            maxAgeDays: 30,
            keywords: ['cybersecurity', 'IT services', 'software development']
          }
        };

        switch (currentAnalysisType) {
          case 'probability':
            endpoint = '/ai/win-probability';
            data = { contractId, userContext };
            break;
          case 'similarity':
            endpoint = '/ai/similar-contracts';
            data = { contractId, limit: 10, userContext };
            break;
          case 'strategy':
            endpoint = '/ai/optimize-strategy';
            data = { contractId, userContext };
            break;
          case 'comprehensive':
          default:
            endpoint = '/ai/comprehensive-analysis';
            data = { contractId, userId: 'current-user', userContext };
            break;
        }

        const response = await api.post(endpoint, data);
        console.log('API response status:', response.status);
        console.log('API response data:', JSON.stringify(response.data, null, 2));
        
        // Handle different response structures
        let analysisData: AnalysisData;
        if (currentAnalysisType === 'comprehensive') {
          analysisData = (response.data.analysis || response.data.data || response.data) as ComprehensiveAnalysis;
        } else {
          // For specific analysis types, build a comprehensive structure
          const contract = response.data.contract || await api.get(`/contracts/${contractId}`).then(r => r.data);
          
          analysisData = {
            contract: {
              id: contract.noticeId || contract.id,
              title: contract.title,
              agency: contract.agency,
              naicsCode: contract.naicsCode,
              awardAmount: contract.awardAmount,
              postedDate: contract.postedDate,
              responseDeadline: contract.responseDeadline
            }
          };

          switch (currentAnalysisType) {
            case 'probability':
              analysisData.winProbability = response.data.prediction || response.data;
              analysisData.overallRecommendation = {
                action: 'evaluate',
                confidence: 'low',
                reasoning: 'Probability analysis completed',
                priority: 'medium'
              };
              // Add recommendation based on probability
              const prob = analysisData.winProbability?.probability || 0;
              if (prob >= 70) {
                analysisData.overallRecommendation = {
                  action: 'pursue',
                  confidence: 'high',
                  reasoning: 'Strong win probability based on analysis',
                  priority: 'high'
                };
              } else if (prob >= 50) {
                analysisData.overallRecommendation = {
                  action: 'consider',
                  confidence: 'medium',
                  reasoning: 'Moderate probability - strategic adjustments needed',
                  priority: 'medium'
                };
              } else {
                analysisData.overallRecommendation = {
                  action: 'evaluate',
                  confidence: 'low',
                  reasoning: 'Low probability - assess strategic value vs effort',
                  priority: 'low'
                };
              }
              break;
            case 'similarity':
              analysisData.similarContracts = response.data.similarities || response.data;
              analysisData.overallRecommendation = {
                action: 'analyze',
                confidence: 'medium',
                reasoning: 'Similar contracts analysis completed',
                priority: 'medium'
              };
              break;
            case 'strategy':
              analysisData.bidStrategy = response.data.strategy || response.data;
              analysisData.overallRecommendation = {
                action: 'plan',
                confidence: 'high',
                reasoning: 'Bid strategy optimization completed',
                priority: 'high'
              };
              break;
          }
        }

        if (analysisData && analysisData.contract) {
          setAnalysis(analysisData);
        } else if (response.data.success === false) {
          setError(response.data.error || 'Analysis failed');
        } else {
          console.error('Invalid data structure:', response.data);
          setError('Invalid analysis data format received');
        }
      } catch (error: any) {
        console.error('Error fetching analysis:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        
        if (error.response?.status === 404) {
          setError('AI analysis service not found. Please check if the backend is running.');
        } else if (error.response?.status === 400) {
          setError(`Invalid contract ID or request format: ${error.response.data?.error || 'Bad request'}`);
        } else if (error.response?.status === 500) {
          setError('Server error. Please try again later.');
        } else {
          setError(`Failed to load analysis: ${error.message || 'Unknown error'}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [contractId, analysisType]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'pursue': return 'bg-green-100 text-green-800';
      case 'consider': return 'bg-yellow-100 text-yellow-800';
      case 'evaluate': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const CustomButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string }> = ({ onClick, children, className = '' }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${className}`}
    >
      {children}
    </button>
  );

  const CustomCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-white shadow-lg rounded-lg overflow-hidden ${className}`}>
      {children}
    </div>
  );

  const CustomBadge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${className}`}>
      {children}
    </span>
  );

  const CustomProgress: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AI Analysis Results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <CustomButton onClick={() => navigate(backNavigation.path)}>
            <ArrowLeft className="w-4 h-4 mr-2 inline" />
            {backNavigation.label}
          </CustomButton>
        </div>
      </div>
    );
  }

  if (!analysis || !analysis.contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No analysis data found.</p>
          <CustomButton onClick={() => navigate(backNavigation.path)}>
            <ArrowLeft className="w-4 h-4 mr-2 inline" />
            {backNavigation.label}
          </CustomButton>
        </div>
      </div>
    );
  }

  const getPageTitle = () => {
    switch (analysisType) {
      case 'comprehensive': return 'AI Comprehensive Analysis';
      case 'probability': return 'Win Probability Analysis';
      case 'similarity': return 'Similar Contracts Analysis';
      case 'strategy': return 'Bid Strategy Optimization';
      case 'opportunities': return 'AI Opportunity Alerts';
      case 'analytics': return 'AI Analytics Dashboard';
      default: return 'AI Analysis Results';
    }
  };

  const getPageSubtitle = () => {
    switch (analysisType) {
      case 'comprehensive': return 'Complete intelligence for contract decision making';
      case 'probability': return 'Predict your likelihood of winning this contract';
      case 'similarity': return 'Find similar past contracts for reference';
      case 'strategy': return 'Optimize your bidding approach and timeline';
      case 'opportunities': return 'Discover matching opportunities powered by AI';
      case 'analytics': return 'Advanced analytics and insights';
      default: return 'AI-powered contract analysis';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <CustomButton onClick={() => navigate(backNavigation.path)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2 inline" />
            {backNavigation.label}
          </CustomButton>
          <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
          <p className="text-gray-600 mt-2">{getPageSubtitle()}</p>
        </div>

        {/* Contract Overview */}
        <CustomCard className="mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="flex items-center text-lg font-semibold text-gray-900">
              <Target className="w-5 h-5 mr-2" />
              Contract Overview
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-gray-900">{analysis.contract.title}</h4>
                <p className="text-sm text-gray-600">{analysis.contract.agency}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">NAICS Code</p>
                <p className="font-semibold">{analysis.contract.naicsCode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Posted Date</p>
                <p className="font-semibold">{new Date(analysis.contract.postedDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CustomCard>

        {/* Overall Recommendation */}
        <CustomCard className="mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="flex items-center text-lg font-semibold text-gray-900">
              <TrendingUp className="w-5 h-5 mr-2" />
              Overall Recommendation
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <CustomBadge className={getActionColor(analysis.overallRecommendation?.action || 'evaluate')}>
                  {analysis.overallRecommendation?.action?.toUpperCase() || 'EVALUATE'}
                </CustomBadge>
                <p className={`mt-2 font-semibold ${getPriorityColor(analysis.overallRecommendation?.priority || 'medium')}`}>
                  {analysis.overallRecommendation?.priority?.toUpperCase() || 'MEDIUM'} PRIORITY
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Confidence</p>
                <p className="text-2xl font-bold text-gray-900">{analysis.overallRecommendation?.confidence?.toUpperCase() || 'MEDIUM'}</p>
              </div>
            </div>
            <p className="mt-4 text-gray-700">{analysis.overallRecommendation?.reasoning || 'Analysis completed successfully.'}</p>
          </div>
        </CustomCard>

        {/* Win Probability - Show only for probability or comprehensive analysis */}
        {(analysisType === 'probability' || analysisType === 'comprehensive') && analysis.winProbability && (
          <CustomCard className="mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="flex items-center text-lg font-semibold text-gray-900">
                <Target className="w-5 h-5 mr-2" />
                {analysisType === 'probability' ? 'Win Probability Analysis' : 'Win Probability Analysis'}
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Win Probability</span>
                    <span>{analysis.winProbability?.probability !== undefined && analysis.winProbability?.probability !== null ? analysis.winProbability.probability : 0}% <span className="text-xs text-gray-500">({analysis.winProbability?.probability !== undefined && analysis.winProbability?.probability !== null ? 'Real Data' : 'Limited Training Data'})</span></span>
                  </div>
                  <CustomProgress value={analysis.winProbability?.probability || 0} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Confidence</span>
                    <span>{Math.min(analysis.winProbability?.confidence || 0, 100)}%</span>
                  </div>
                  <CustomProgress value={Math.min(analysis.winProbability?.confidence || 0, 100)} />
                </div>
                
                {analysis.winProbability?.factors?.length > 0 && analysisType === 'probability' && (
                  <div>
                    <h4 className="font-semibold mb-2">Key Factors</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {analysis.winProbability.factors.map((factor: string, index: number) => (
                        <li key={index}>• {factor}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.winProbability?.recommendations?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">AI Recommendations</h4>
                    <div className="space-y-2">
                      {analysis.winProbability.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="text-sm bg-blue-50 p-3 rounded">
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CustomCard>
        )}

        {/* Bid Strategy - Show only for strategy or comprehensive analysis */}
        {(analysisType === 'strategy' || analysisType === 'comprehensive') && analysis.bidStrategy && (
          <CustomCard className="mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="flex items-center text-lg font-semibold text-gray-900">
                <Clock className="w-5 h-5 mr-2" />
                {analysisType === 'strategy' ? 'Bid Strategy Optimization' : 'Bid Strategy & Timeline'}
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Estimated Competition</h4>
                  <p className="text-2xl font-bold text-gray-900">
                    {analysis.bidStrategy?.competitionAnalysis?.estimatedBidders || 'N/A'} bidders
                  </p>
                  <p className="text-sm text-gray-600">
                    Range: {analysis.bidStrategy?.competitionAnalysis?.bidderRange?.min || 'N/A'}-{analysis.bidStrategy?.competitionAnalysis?.bidderRange?.max || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Timeline</h4>
                  <div className="space-y-2">
                    {analysis.bidStrategy?.executionPlan?.phases?.map((phase: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{phase.name}</span>
                        <span>{phase.duration} days</span>
                      </div>
                    )) || <p className="text-sm text-gray-500">No timeline data available</p>}
                  </div>
                </div>
              </div>

              {analysis.bidStrategy?.recommendations?.length > 0 && analysisType === 'strategy' && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Strategic Recommendations</h4>
                  <div className="space-y-2">
                    {analysis.bidStrategy.recommendations.map((rec: any, index: number) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                        <p className="font-medium">{rec.title}</p>
                        <p className="text-sm text-gray-600">{rec.description}</p>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                          rec.impact === 'high' ? 'bg-red-100 text-red-800' : 
                          rec.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.impact} impact
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CustomCard>
        )}

        {/* Similar Contracts - Show only for similarity or comprehensive analysis */}
        {(analysisType === 'similarity' || analysisType === 'comprehensive') && analysis.similarContracts && (
          <CustomCard>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="flex items-center text-lg font-semibold text-gray-900">
                <DollarSign className="w-5 h-5 mr-2" />
                {analysisType === 'similarity' ? 'Similar Contracts Analysis' : 'Similar Contracts Found'}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Found {analysis.similarContracts?.matches?.length || 0} similar contracts for comparison
              </p>
              {analysis.similarContracts?.insights?.length > 0 && analysisType === 'similarity' && (
                <div className="space-y-2">
                  {analysis.similarContracts.insights.map((insight: any, index: number) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      <p className="font-medium text-sm">{insight.title}: {insight.value}</p>
                      <p className="text-xs text-gray-600">{insight.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CustomCard>
        )}
      </div>
    </div>
  );
};

export default AIAnalysisResults;