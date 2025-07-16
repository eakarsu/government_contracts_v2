import api from './api';

export interface WinProbabilityResponse {
  probability: number;
  confidence: number;
  factors: string[];
  recommendations: string[];
}

export interface SimilarContract {
  contract: {
    id: string;
    title: string;
    agency: string;
    naicsCode: string;
    awardAmount: string;
    postedDate: string;
    awardedTo?: string;
  };
  similarity: number;
  factors: Record<string, number>;
  keyMatches: string[];
}

export interface ContractSimilarityResponse {
  matches: SimilarContract[];
  summary: {
    totalMatches: number;
    uniqueAgencies: number;
    commonNaics: string[];
    averageAwardAmount: number;
    dateRange: {
      oldest: Date;
      newest: Date;
    };
  };
  insights: Array<{
    type: string;
    title: string;
    value: string;
    description: string;
  }>;
}

export interface AIAlert {
  id: string;
  title: string;
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  opportunity: {
    id: string;
    title: string;
    agency: string;
    awardAmount: string;
    responseDeadline: string;
  };
  overallScore: number;
  winProbability: number;
  urgency: number;
  metadata: {
    estimatedTimeline: {
      daysUntilDeadline: number;
    };
    similarWins: any[];
    keyRequirements: string[];
  };
  actions: Array<{
    type: string;
    label: string;
    action: string;
  }>;
}

export interface BidStrategyResponse {
  pricingStrategy: {
    recommendedPrice: number;
    priceRange: {
      conservative: number;
      aggressive: number;
    };
    pricingJustification: string[];
    profitMargin: number;
  };
  competitionAnalysis: {
    estimatedBidders: number;
    bidderRange: {
      min: number;
      max: number;
    };
    competitiveIntensity: number;
  };
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
    action: string;
  }>;
  executionPlan: {
    phases: Array<{
      name: string;
      duration: number;
      tasks: string[];
      dependencies: string[];
    }>;
    resourceAllocation: {
      estimatedHours: number;
      teamSize: number;
      keyRoles: string[];
    };
  };
  riskAssessment: Array<{
    category: string;
    level: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    mitigation: string;
  }>;
}

export interface ComprehensiveAnalysis {
  contract: {
    id: string;
    title: string;
    agency: string;
    naicsCode: string;
    awardAmount: string;
    postedDate: string;
    responseDeadline: string;
  };
  winProbability: WinProbabilityResponse;
  similarContracts: ContractSimilarityResponse;
  opportunities: AIAlert[];
  bidStrategy: BidStrategyResponse;
  overallRecommendation: {
    action: string;
    confidence: string;
    reasoning: string;
    priority: string;
  };
}

export interface UserContext {
  companyProfile?: {
    annualRevenue?: number;
    certifications?: string[];
    experienceInNaics?: string[];
    agencyRelationships?: string[];
    pastWins?: string[];
    hasBonding?: boolean;
  };
  preferences?: {
    minContractValue?: number;
    preferredNaicsCodes?: string[];
    preferredAgencies?: string[];
    preferredStates?: string[];
    keywords?: string[];
    maxAgeDays?: number;
  };
}

class AIService {
  async predictWinProbability(contractId: string, userContext?: UserContext): Promise<WinProbabilityResponse> {
    const response = await api.post('/ai/win-probability', {
      contractId,
      userContext
    });
    return response.data;
  }

  async findSimilarContracts(contractId: string, limit: number = 5, userContext?: UserContext): Promise<ContractSimilarityResponse> {
    const response = await api.post('/ai/similar-contracts', {
      contractId,
      limit,
      userContext
    });
    return response.data;
  }

  async getOpportunityAlerts(userId: string, userContext?: UserContext): Promise<{
    alerts: AIAlert[];
    summary: {
      totalAlerts: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      totalValue: number;
      averageWinProbability: number;
    };
    recommendations: Array<{
      type: string;
      title: string;
      description: string;
      priority: string;
    }>;
  }> {
    const response = await api.post('/ai/opportunity-alerts', {
      userId,
      userContext
    });
    return response.data;
  }

  async optimizeBidStrategy(contractId: string, userContext?: UserContext): Promise<BidStrategyResponse> {
    const response = await api.post('/ai/optimize-strategy', {
      contractId,
      userContext
    });
    return response.data;
  }

  async getComprehensiveAnalysis(
    contractId: string, 
    userId: string, 
    userContext?: UserContext
  ): Promise<ComprehensiveAnalysis> {
    const response = await api.post('/ai/comprehensive-analysis', {
      contractId,
      userId,
      userContext
    });
    return response.data;
  }

  async batchAnalyzeContracts(
    contractIds: string[], 
    userContext?: UserContext
  ): Promise<Array<{
    contractId: string;
    contract: {
      id: string;
      title: string;
      agency: string;
      awardAmount: string;
    };
    winProbability: WinProbabilityResponse;
    similarContracts: number;
    overallScore: number;
  }>> {
    const response = await api.post('/ai/batch-analysis', {
      contractIds,
      userContext
    });
    return response.data.results;
  }

  async updateUserPreferences(userId: string, preferences: UserContext['preferences']): Promise<any> {
    const response = await api.post('/ai/preferences', {
      userId,
      preferences
    });
    return response.data;
  }

  async getUserPreferences(userId: string): Promise<any> {
    const response = await api.get(`/ai/preferences/${userId}`);
    return response.data;
  }

  async checkAIServiceHealth(): Promise<{
    status: string;
    services: Record<string, string>;
    timestamp: string;
  }> {
    const response = await api.get('/ai/health');
    return response.data;
  }
}

export const aiService = new AIService();