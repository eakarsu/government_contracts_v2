import api from './api';
import type { Contract, ContractAnalysis, SearchForm, SearchResult, ApiResponse } from '../types';

export class ContractsApiService {
  async fetchContracts(data: any): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/contracts/fetch', data, {
      timeout: 1800000
    });
    return response.data;
  }

  async indexContracts(limit: number = 100): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/contracts/index', { limit }, {
      timeout: 3600000 // 1 hour timeout
    });
    return response.data;
  }

  async getContracts(page: number = 1, limit: number = 20, filters?: {
    search?: string;
    agency?: string;
    naicsCode?: string;
  }): Promise<{ 
    success: boolean;
    data: Contract[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (filters?.search) params.append('search', filters.search);
    if (filters?.agency) params.append('agency', filters.agency);
    if (filters?.naicsCode) params.append('naicsCode', filters.naicsCode);
    
    const response = await api.get<{ 
      success: boolean;
      data: Contract[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/contracts?${params.toString()}`);
    return response.data;
  }

  async getContract(noticeId: string): Promise<Contract> {
    const response = await api.get<Contract>(`/contracts/${noticeId}`);
    return response.data;
  }

  async analyzeContract(noticeId: string): Promise<ContractAnalysis> {
    const response = await api.post<ContractAnalysis>(`/documents/contracts/${noticeId}/analyze`);
    return response.data;
  }

  async searchContracts(data: SearchForm): Promise<SearchResult> {
    if (!data.query || data.query.trim() === '') {
      throw new Error('Query parameter is required');
    }
    const response = await api.post<SearchResult>('/search', data);
    return response.data;
  }

  async getRecommendations(criteria: {
    naics_codes?: string[];
    agencies?: string[];
    keywords?: string[];
  }): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/recommendations', criteria);
    return response.data;
  }
}

export const contractsApi = new ContractsApiService();
