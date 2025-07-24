import api from './api';
import type {
  RFPTemplate,
  RFPTemplateForm,
  CompanyProfile,
  CompanyProfileForm,
  RFPAnalysis,
  CompetitiveAnalysis,
  RFPGenerationRequest,
  RFPGenerationResponse,
  RFPResponse,
  RFPResponseSection,
  RFPSectionEditForm,
  ComplianceStatus,
  PredictedScore,
  RFPVersion,
  RFPDashboardStats,
} from '../types';

class RFPApiService {
  // RFP Templates
  async getRFPTemplates(): Promise<{ success: boolean; templates: RFPTemplate[] }> {
    const response = await api.get<{ success: boolean; templates: RFPTemplate[] }>('/rfp/templates');
    return response.data;
  }

  async getRFPTemplate(templateId: number): Promise<{ success: boolean; template: RFPTemplate }> {
    const response = await api.get<{ success: boolean; template: RFPTemplate }>(`/rfp/templates/${templateId}`);
    return response.data;
  }

  async createRFPTemplate(template: RFPTemplateForm): Promise<{ success: boolean; template: RFPTemplate }> {
    const response = await api.post<{ success: boolean; template: RFPTemplate }>('/rfp/templates', template);
    return response.data;
  }

  async updateRFPTemplate(templateId: number, template: Partial<RFPTemplateForm>): Promise<{ success: boolean; template: RFPTemplate }> {
    const response = await api.put<{ success: boolean; template: RFPTemplate }>(`/rfp/templates/${templateId}`, template);
    return response.data;
  }

  async deleteRFPTemplate(templateId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/rfp/templates/${templateId}`);
    return response.data;
  }

  // Company Profiles
  async getCompanyProfiles(): Promise<{ success: boolean; profiles: CompanyProfile[] }> {
    const response = await api.get<{ success: boolean; profiles: CompanyProfile[] }>('/rfp/company-profiles');
    return response.data;
  }

  async getCompanyProfile(profileId: number): Promise<{ success: boolean; profile: CompanyProfile }> {
    const response = await api.get<{ success: boolean; profile: CompanyProfile }>(`/rfp/company-profiles/${profileId}`);
    return response.data;
  }

  async createCompanyProfile(profile: CompanyProfileForm): Promise<{ success: boolean; profile: CompanyProfile }> {
    const response = await api.post<{ success: boolean; profile: CompanyProfile }>('/rfp/company-profiles', profile);
    return response.data;
  }

  async updateCompanyProfile(profileId: number, profile: Partial<CompanyProfileForm>): Promise<{ success: boolean; profile: CompanyProfile }> {
    const response = await api.put<{ success: boolean; profile: CompanyProfile }>(`/rfp/company-profiles/${profileId}`, profile);
    return response.data;
  }

  async deleteCompanyProfile(profileId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/rfp/company-profiles/${profileId}`);
    return response.data;
  }

  // RFP Analysis
  async analyzeContractForRFP(contractId: string): Promise<{ success: boolean; analysis: RFPAnalysis }> {
    console.log('🔍 [DEBUG] API Service analyzeContractForRFP called for:', contractId);
    const response = await api.post<{ success: boolean; analysis: RFPAnalysis }>(`/rfp/analyze/${contractId}`);
    console.log('🔍 [DEBUG] API Service analyzeContractForRFP response:', response.data);
    return response.data;
  }

  async getCompetitiveAnalysis(contractId: string, companyProfileId: number): Promise<{ success: boolean; analysis: CompetitiveAnalysis }> {
    const response = await api.post<{ success: boolean; analysis: CompetitiveAnalysis }>('/rfp/competitive-analysis', {
      contractId,
      companyProfileId
    });
    return response.data;
  }

  // RFP Generation
  async generateRFPResponse(request: RFPGenerationRequest): Promise<RFPGenerationResponse> {
    console.log('🚀 [DEBUG] Starting async RFP generation');
    console.log('📋 [DEBUG] Request data:', JSON.stringify(request, null, 2));
    
    try {
      // Start async job
      console.log('📤 [DEBUG] Sending request to /rfp/generate-async...');
      const startResponse = await api.post('/rfp/generate-async', request);
      console.log('📥 [DEBUG] Start response received:', startResponse.data);
      
      const jobId = startResponse.data.jobId;
      console.log(`🆔 [DEBUG] Job started with ID: ${jobId}`);
      console.log(`⏱️ [DEBUG] Estimated time: ${startResponse.data.estimatedTime || 'Unknown'}`);
      
      let pollCount = 0;
      const maxPolls = 480; // 40 minutes max (5 sec intervals)
      
      // Poll for completion
      while (pollCount < maxPolls) {
        pollCount++;
        console.log(`🔄 [DEBUG] Poll attempt ${pollCount}/${maxPolls} - Checking job status...`);
        
        try {
          const statusResponse = await api.get(`/rfp/jobs/${jobId}`);
          console.log(`📊 [DEBUG] Status response:`, statusResponse.data);
          
          const job = statusResponse.data;
          console.log(`📋 [DEBUG] Job details: Status=${job.status}, Progress=${job.progress?.current || 0}/${job.progress?.total || 15}`);
          console.log(`💬 [DEBUG] Progress message: ${job.progress?.message || 'N/A'}`);
          
          if (job.status === 'completed') {
            console.log('✅ [DEBUG] RFP generation completed successfully!');
            console.log(`🎯 [DEBUG] RFP Response ID: ${job.rfpResponseId}`);
            console.log(`⏱️ [DEBUG] Total polling time: ${pollCount * 5} seconds`);
            return {
              success: true,
              rfpResponseId: job.rfpResponseId,
              message: 'RFP generated successfully',
              generationTime: pollCount * 5,
              sectionsGenerated: job.progress?.total || 15,
              complianceScore: 0,
              predictedScore: 0
            } as RFPGenerationResponse;
          }
          
          if (job.status === 'failed') {
            console.error('❌ [DEBUG] RFP generation failed!');
            console.error('💥 [DEBUG] Error details:', job.error);
            console.error('🕐 [DEBUG] Failed after:', job.createdAt);
            throw new Error(job.error || 'RFP generation failed');
          }
          
          if (job.status === 'processing') {
            console.log(`⚡ [DEBUG] Job is processing... Section ${job.progress?.current || 0}/${job.progress?.total || 15}`);
          } else if (job.status === 'queued') {
            console.log('⏳ [DEBUG] Job is still queued, waiting to start...');
          }
          
        } catch (statusError: any) {
          console.error('❌ [DEBUG] Error checking job status:', statusError.message);
          console.error('📡 [DEBUG] Status check failed for job:', jobId);
          
          // Continue polling unless it's a 404 (job not found)
          if (statusError.response?.status === 404) {
            throw new Error(`Job ${jobId} not found - may have been cleaned up`);
          }
        }
        
        // Wait 5 seconds before checking again
        console.log('⏱️ [DEBUG] Waiting 5 seconds before next poll...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // If we get here, polling timed out
      console.error('⏰ [DEBUG] Polling timed out after 40 minutes!');
      throw new Error(`RFP generation timed out after ${maxPolls * 5} seconds of polling`);
      
    } catch (error: any) {
      console.error('💥 [DEBUG] Error in generateRFPResponse:', error);
      console.error('📋 [DEBUG] Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  // TODO: Chunked processing to avoid gateway timeouts for large RFPs
  // This would require server-side support for chunked generation
  // private async generateRFPResponseInChunks(request: RFPGenerationRequest): Promise<RFPGenerationResponse> {
  //   // Implementation would go here
  // }

  async regenerateRFPSection(rfpResponseId: number, sectionId: string, customInstructions?: string): Promise<{ success: boolean; section: RFPResponseSection }> {
    const response = await api.post<{ success: boolean; section: RFPResponseSection }>(`/rfp/responses/${rfpResponseId}/sections/${sectionId}/regenerate`, {
      customInstructions
    });
    return response.data;
  }

  // RFP Response Management
  async getRFPResponses(page: number = 1, limit: number = 20): Promise<{ success: boolean; responses: RFPResponse[]; pagination: any }> {
    try {
      const response = await api.get<{ success: boolean; responses: RFPResponse[]; pagination: any }>(`/rfp/responses?page=${page}&limit=${limit}`);
      
      // Filter out deleted RFPs from the response
      const deletedRFPs = JSON.parse(localStorage.getItem('deleted_rfp_ids') || '[]');
      if (response.data.success && response.data.responses) {
        const filteredResponses = response.data.responses.filter(rfp => !deletedRFPs.includes(rfp.id));
        return {
          ...response.data,
          responses: filteredResponses
        };
      }
      
      return response.data;
    } catch (error: any) {
      // Handle 404 or other errors for missing endpoint
      if (error.response?.status === 404) {
        console.warn('RFP Responses endpoint not implemented yet');
        return {
          success: false,
          responses: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
        };
      }
      throw error;
    }
  }

  async getRFPResponse(responseId: number): Promise<{ success: boolean; response: RFPResponse }> {
    try {
      // Check if this RFP has been deleted locally
      const deletedRFPs = JSON.parse(localStorage.getItem('deleted_rfp_ids') || '[]');
      if (deletedRFPs.includes(responseId)) {
        console.log('🗑️ [DEBUG] RFP Response', responseId, 'has been deleted locally');
        throw new Error('RFP Response has been deleted');
      }

      console.log(`🔍 [DEBUG] API Service getRFPResponse called with ID: ${responseId}`);
      const response = await api.get<{ success: boolean; response: RFPResponse }>(`/rfp/responses/${responseId}`);
      console.log('✅ [DEBUG] API Service getRFPResponse success:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [DEBUG] API Service getRFPResponse error:', error);
      // Handle 404 or other errors for missing endpoint
      if (error.response?.status === 404) {
        console.warn('RFP Response endpoint not implemented yet');
        throw new Error('RFP Response not found');
      }
      throw error;
    }
  }

  async updateRFPResponse(responseId: number, updates: Partial<RFPResponse>): Promise<{ success: boolean; response: RFPResponse }> {
    const response = await api.put<{ success: boolean; response: RFPResponse }>(`/rfp/responses/${responseId}`, updates);
    return response.data;
  }

  async updateRFPSection(rfpResponseId: number, sectionId: string, updates: RFPSectionEditForm): Promise<{ success: boolean; section: RFPResponseSection }> {
    const response = await api.put<{ success: boolean; section: RFPResponseSection }>(`/rfp/responses/${rfpResponseId}/sections/${sectionId}`, updates);
    return response.data;
  }

  async deleteRFPResponse(responseId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/rfp/responses/${responseId}`);
    return response.data;
  }

  // RFP Compliance & Scoring
  async checkRFPCompliance(responseId: number): Promise<{ success: boolean; compliance: ComplianceStatus }> {
    const response = await api.post<{ success: boolean; compliance: ComplianceStatus }>(`/rfp/responses/${responseId}/compliance`);
    return response.data;
  }

  async predictRFPScore(responseId: number): Promise<{ success: boolean; prediction: PredictedScore }> {
    const response = await api.post<{ success: boolean; prediction: PredictedScore }>(`/rfp/responses/${responseId}/score-prediction`);
    return response.data;
  }

  // RFP Export & Collaboration
  async exportRFPResponse(responseId: number, format: 'pdf' | 'docx' | 'html'): Promise<{ success: boolean; downloadUrl: string }> {
    const response = await api.post<{ success: boolean; downloadUrl: string }>(`/rfp/responses/${responseId}/export`, { format });
    return response.data;
  }

  async addRFPCollaborator(responseId: number, email: string, role: 'viewer' | 'editor' | 'reviewer'): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/rfp/responses/${responseId}/collaborators`, { email, role });
    return response.data;
  }

  async removeRFPCollaborator(responseId: number, email: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/rfp/responses/${responseId}/collaborators/${email}`);
    return response.data;
  }

  // RFP Versions
  async createRFPVersion(responseId: number, comment?: string): Promise<{ success: boolean; version: RFPVersion }> {
    const response = await api.post<{ success: boolean; version: RFPVersion }>(`/rfp/responses/${responseId}/versions`, { comment });
    return response.data;
  }

  async getRFPVersions(responseId: number): Promise<{ success: boolean; versions: RFPVersion[] }> {
    const response = await api.get<{ success: boolean; versions: RFPVersion[] }>(`/rfp/responses/${responseId}/versions`);
    return response.data;
  }

  async restoreRFPVersion(responseId: number, versionId: number): Promise<{ success: boolean; response: RFPResponse }> {
    const response = await api.post<{ success: boolean; response: RFPResponse }>(`/rfp/responses/${responseId}/versions/${versionId}/restore`);
    return response.data;
  }

  // RFP Dashboard & Analytics
  async getRFPDashboardStats(): Promise<{ success: boolean; stats: RFPDashboardStats }> {
    const response = await api.get<{ success: boolean; stats: RFPDashboardStats }>('/rfp/dashboard/stats');
    return response.data;
  }

  async getRFPAnalytics(dateRange?: { start: string; end: string }): Promise<{ success: boolean; analytics: any }> {
    try {
      const params = dateRange ? `?start=${dateRange.start}&end=${dateRange.end}` : '';
      const response = await api.get<{ success: boolean; analytics: any }>(`/rfp/analytics${params}`);
      return response.data;
    } catch (error: any) {
      // Handle 404 for missing analytics endpoint
      if (error.response?.status === 404) {
        console.warn('RFP Analytics endpoint not implemented yet');
        return {
          success: false,
          analytics: {
            message: 'Analytics endpoint not yet implemented',
            totalRFPs: 0,
            winRate: 0,
            averageScore: 0
          }
        };
      }
      throw error;
    }
  }
}

export const rfpApi = new RFPApiService();
export default rfpApi;