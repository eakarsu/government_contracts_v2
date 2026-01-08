import api from './api';

export interface WinProbabilityFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  score: number;
  description?: string;
  level?: string;
}

export interface WinProbabilityRecommendation {
  type: 'strength' | 'improvement' | 'risk';
  title: string;
  description: string;
  level?: string;
}

export interface CompetitiveAnalysis {
  estimatedCompetitors: number;
  marketPosition: string;
  level?: string;
  keyDifferentiators?: { name: string; level: string }[];
  threats?: { name: string; level: string }[];
}

export interface WinProbabilityPrediction {
  id: string | number;
  contractId: string;
  contractTitle: string;
  agency: string;
  probability: number;
  probabilityScore?: number;
  confidence: string;
  confidenceLevel: number;
  level?: string;
  factors: WinProbabilityFactor[];
  recommendations: WinProbabilityRecommendation[];
  competitiveAnalysis: CompetitiveAnalysis;
  aiPowered?: boolean;
  createdAt: string;
}

export interface BidHistoryItem {
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

export interface BidAnalytics {
  totalBids: number;
  wonBids: number;
  winRate: number;
  avgBidAmount: number;
  predictionAccuracy: number;
  monthlyTrends: { month: string; bids: number; wins: number; accuracy: number; level: string }[];
  topFactors: { factor: string; avgImpact: number; level: string }[];
}

class BidPredictionApiService {
  async getPredictions(limit: number = 20, offset: number = 0): Promise<{
    success: boolean;
    predictions: WinProbabilityPrediction[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  }> {
    const response = await api.get(`/bid-prediction/predictions?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  async getHistory(): Promise<{
    success: boolean;
    bidHistory: BidHistoryItem[];
    analytics: BidAnalytics;
  }> {
    const response = await api.get('/bid-prediction/history');
    return response.data;
  }

  async analyzeBid(data: {
    contractId: string;
    contractTitle?: string;
    agency?: string;
    estimatedValue?: number;
  }): Promise<{
    success: boolean;
    prediction: WinProbabilityPrediction;
  }> {
    const response = await api.post('/bid-prediction/analyze', data);
    return response.data;
  }

  async predictWinProbability(contractId: string, companyProfile?: any): Promise<{
    success: boolean;
    contractId: string;
    prediction: WinProbabilityPrediction;
  }> {
    const response = await api.post(`/bid-prediction/predict/${contractId}`, { companyProfile });
    return response.data;
  }
}

export const bidPredictionApi = new BidPredictionApiService();
