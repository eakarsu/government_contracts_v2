import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  ChevronLeft,
  Building2,
  Calendar,
  Tag,
  RefreshCw,
  BarChart3,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Database,
  Sparkles,
  File,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  Paperclip,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Award,
  Shield
} from 'lucide-react';
import { apiService } from '../services/api';
import { ContractAnalysis } from '../types';

interface CompanyProfile {
  id: number;
  companyName: string;
  basicInfo?: any;
  capabilities?: any;
  pastPerformance?: any[];
  keyPersonnel?: any[];
}

const ContractDetail: React.FC = () => {
  const { noticeId } = useParams<{ noticeId: string }>();
  const navigate = useNavigate();
  const [analysisResults, setAnalysisResults] = useState<ContractAnalysis | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch company profiles
  const { data: companyProfiles } = useQuery({
    queryKey: ['companyProfiles'],
    queryFn: async () => {
      const response = await fetch('/api/rfp/company-profiles');
      const data = await response.json();
      return data.profiles as CompanyProfile[];
    },
  });

  // Helper to get file info from URL
  const getFileInfo = (url: string, index: number) => {
    const docExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'zip', 'rar', '7z', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'txt', 'rtf'];
    let filename = '';
    let ext = '';

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const part = decodeURIComponent(pathParts[i]);
        const partExt = part.split('.').pop()?.toLowerCase() || '';
        if (docExtensions.includes(partExt)) {
          filename = part;
          ext = partExt;
          break;
        }
      }
    } catch (e) {}

    if (!filename || !ext) {
      filename = `Attachment ${index + 1}`;
      ext = '';
    }

    let type = 'Document';
    let icon = File;
    let color = 'text-gray-500';

    if (['pdf'].includes(ext)) { type = 'PDF'; icon = FileText; color = 'text-red-500'; }
    else if (['doc', 'docx'].includes(ext)) { type = 'Word'; icon = FileText; color = 'text-blue-500'; }
    else if (['xls', 'xlsx', 'csv'].includes(ext)) { type = 'Excel'; icon = FileSpreadsheet; color = 'text-green-500'; }
    else if (['ppt', 'pptx'].includes(ext)) { type = 'PowerPoint'; icon = FileText; color = 'text-orange-500'; }
    else if (['zip', 'rar', '7z'].includes(ext)) { type = 'Archive'; icon = FileArchive; color = 'text-yellow-600'; }
    else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) { type = 'Image'; icon = FileImage; color = 'text-purple-500'; }

    return { filename, ext, type, icon, color };
  };

  // SAM.gov URL helper
  const getSamGovUrl = (id: string) => `https://sam.gov/opp/${id}/view`;

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['contract', noticeId],
    queryFn: () => apiService.getContract(noticeId!),
    enabled: !!noticeId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/documents/contracts/${noticeId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyProfileId: selectedProfileId })
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisResults(data);
      queryClient.invalidateQueries({ queryKey: ['contract', noticeId] });
    },
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-200';
      case 'processing': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'failed': return 'bg-red-50 text-red-700 border-red-200';
      case 'queued': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Contract Not Found</h2>
          <p className="text-sm text-gray-500 mb-4">
            {error ? (error instanceof Error ? error.message : 'Unknown error') : `Contract "${noticeId}" could not be found.`}
          </p>
          <Link to="/search" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 group"
      >
        <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
        Back to Previous Page
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                {contract.title || 'Untitled Contract'}
              </h1>
              <p className="text-sm text-gray-500">Notice ID: {contract.noticeId}</p>
            </div>
            <div className="flex items-center gap-3">
              {!noticeId?.startsWith('SAMPLE_') && (
                <a
                  href={getSamGovUrl(contract.noticeId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on SAM.gov
                </a>
              )}
              {/* Company Profile Selector */}
              <select
                value={selectedProfileId || ''}
                onChange={(e) => setSelectedProfileId(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Company Profile</option>
                {companyProfiles?.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.companyName}
                  </option>
                ))}
              </select>
              <button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {analyzeMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><Target className="h-4 w-4" /> {selectedProfileId ? 'Analyze Fit' : 'Analyze Contract'}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Contract Details Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Details */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase mb-4">Contract Details</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Agency</p>
                    <p className="text-sm font-medium text-gray-900">{contract.agency || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">NAICS Code</p>
                    <p className="text-sm font-medium text-gray-900">{contract.naicsCode || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Classification Code</p>
                    <p className="text-sm font-medium text-gray-900">{contract.classificationCode || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Posted Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(contract.postedDate)}</p>
                  </div>
                </div>
                {contract.setAsideCode && (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Set Aside</p>
                      <p className="text-sm font-medium text-gray-900">{contract.setAsideCode}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Description */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase mb-4">Description</h3>
              {contract.descriptionIncomplete ? (
                // Show SAM.gov link for incomplete descriptions
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 mb-3">
                    Full description not available in database. View on SAM.gov for complete details.
                  </p>
                  <a
                    href={contract.samGovUrl || `https://sam.gov/opp/${contract.noticeId}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Full Description on SAM.gov
                  </a>
                </div>
              ) : contract.description ? (
                contract.description.includes('<') && contract.description.includes('>') ? (
                  // Render HTML content from SAM.gov
                  <div
                    className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_a]:text-blue-600 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: contract.description }}
                  />
                ) : (
                  // Render plain text
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {contract.description}
                  </p>
                )
              ) : (
                <p className="text-sm text-gray-500 italic">No description available.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attachments */}
      {contract.resourceLinks && contract.resourceLinks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-gray-500" />
              Attachments ({contract.resourceLinks.length})
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {contract.resourceLinks.map((url: string, idx: number) => {
                const fileInfo = getFileInfo(url, idx);
                const FileIcon = fileInfo.icon;
                return (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                  >
                    <FileIcon className={`h-8 w-8 flex-shrink-0 ${fileInfo.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                        {fileInfo.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fileInfo.type} {fileInfo.ext && `(.${fileInfo.ext})`}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Document Statistics */}
      {contract.statistics && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Document Statistics
            </h2>
          </div>
          <div className="p-6 grid grid-cols-6 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">{contract.statistics.total_resource_links}</p>
              <p className="text-xs text-blue-600">Resources</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">{contract.statistics.downloaded_files_count}</p>
              <p className="text-xs text-green-600">Downloaded</p>
              <p className="text-xs text-gray-500">{contract.statistics.download_completion_rate}%</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-purple-600">{contract.statistics.documents_in_queue}</p>
              <p className="text-xs text-purple-600">In Queue</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-600">{contract.statistics.completed_documents}</p>
              <p className="text-xs text-yellow-600">Processed</p>
              <p className="text-xs text-gray-500">{contract.statistics.processing_completion_rate}%</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-indigo-600">{contract.statistics.documents_in_vector_db}</p>
              <p className="text-xs text-indigo-600">Searchable</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{contract.statistics.failed_documents}</p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
          </div>
        </div>
      )}

      {/* Resource Links */}
      {contract.documents?.resource_links_analysis && contract.documents.resource_links_analysis.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-gray-500" />
              Resource Links ({contract.documents.resource_links_analysis.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Downloaded</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contract.documents.resource_links_analysis.map((link) => (
                  <tr key={link.index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{link.index}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{link.filename}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {link.extension || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {link.is_downloaded ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="h-4 w-4" /> Yes
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <XCircle className="h-4 w-4" /> No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusStyle(link.queue_status)}`}>
                        {link.queue_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResults?.analysis && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              {analysisResults.analysis.company_profile_used ? 'Company Fit Analysis' : 'AI Analysis Results'}
              {analysisResults.ai_powered && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                  Powered by AI
                </span>
              )}
              {analysisResults.analysis.company_profile_used && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                  {analysisResults.analysis.company_profile_used.company_name}
                </span>
              )}
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Company Fit Score Dashboard */}
            {analysisResults.analysis.ai_insights?.fit_score !== undefined && (
              <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Company Fit Score</h3>
                    <p className="text-indigo-100 text-sm">{analysisResults.analysis.company_profile_used?.company_name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-bold">{analysisResults.analysis.ai_insights.fit_score}</div>
                    <div className="text-indigo-200 text-sm">out of 100</div>
                  </div>
                </div>

                {/* Go/No-Go Recommendation */}
                <div className="flex items-center gap-4 mt-4">
                  <div className={`px-4 py-2 rounded-lg font-bold text-sm ${
                    analysisResults.analysis.ai_insights.go_no_go_recommendation === 'GO'
                      ? 'bg-green-500 text-white'
                      : analysisResults.analysis.ai_insights.go_no_go_recommendation === 'NO-GO'
                      ? 'bg-red-500 text-white'
                      : 'bg-yellow-500 text-white'
                  }`}>
                    {analysisResults.analysis.ai_insights.go_no_go_recommendation || 'EVALUATE'}
                  </div>
                  <div className="text-sm">
                    <span className="text-indigo-200">Win Probability: </span>
                    <span className="font-semibold">{analysisResults.analysis.ai_insights.win_probability || 'N/A'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-indigo-200">Bid Investment: </span>
                    <span className="font-semibold">{analysisResults.analysis.ai_insights.bid_investment_level || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Executive Summary */}
            {analysisResults.analysis.ai_insights?.executive_summary && (
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                <h3 className="text-sm font-medium text-indigo-900 mb-2">Executive Summary</h3>
                <p className="text-sm text-indigo-800">{analysisResults.analysis.ai_insights.executive_summary}</p>
                {analysisResults.analysis.ai_insights.opportunity_score && !analysisResults.analysis.ai_insights.fit_score && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-indigo-600">Opportunity Score:</span>
                    <span className={`px-2 py-1 text-xs font-bold rounded ${
                      analysisResults.analysis.ai_insights.opportunity_score >= 7 ? 'bg-green-100 text-green-700' :
                      analysisResults.analysis.ai_insights.opportunity_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {analysisResults.analysis.ai_insights.opportunity_score}/10
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Strengths and Gaps Grid */}
            {(analysisResults.analysis.ai_insights?.strengths?.length || analysisResults.analysis.ai_insights?.gaps?.length) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                {(analysisResults.analysis.ai_insights?.strengths?.length ?? 0) > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Company Strengths
                    </h3>
                    <ul className="space-y-2">
                      {analysisResults.analysis.ai_insights?.strengths?.map((strength: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gaps */}
                {(analysisResults.analysis.ai_insights?.gaps?.length ?? 0) > 0 && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" /> Gaps to Address
                    </h3>
                    <ul className="space-y-2">
                      {analysisResults.analysis.ai_insights?.gaps?.map((gap: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Gap Mitigation */}
            {(analysisResults.analysis.ai_insights?.gap_mitigation?.length ?? 0) > 0 && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Gap Mitigation Strategies
                </h3>
                <ul className="space-y-2">
                  {analysisResults.analysis.ai_insights?.gap_mitigation?.map((mitigation: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-medium flex-shrink-0">
                        {i + 1}
                      </span>
                      {mitigation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Competitive Advantages */}
            {(analysisResults.analysis.ai_insights?.competitive_advantages?.length ?? 0) > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4" /> Competitive Advantages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResults.analysis.ai_insights?.competitive_advantages?.map((advantage: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-blue-100 text-blue-800 text-sm rounded-lg">
                      {advantage}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Teaming Suggestions */}
            {(analysisResults.analysis.ai_insights?.teaming_suggestions?.length ?? 0) > 0 && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Teaming Suggestions
                </h3>
                <ul className="space-y-2">
                  {analysisResults.analysis.ai_insights?.teaming_suggestions?.map((suggestion: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-purple-700">
                      <Users className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risks */}
            {(analysisResults.analysis.ai_insights?.risks?.length ?? 0) > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Key Risks
                </h3>
                <ul className="space-y-2">
                  {analysisResults.analysis.ai_insights?.risks?.map((risk: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Document Analysis Stats */}
            {analysisResults.analysis.document_analysis && (
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1">Resource Links</p>
                  <p className="text-2xl font-bold text-blue-700">{analysisResults.analysis.document_analysis.total_resource_links || 0}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium mb-1">Processed</p>
                  <p className="text-2xl font-bold text-green-700">{analysisResults.analysis.document_analysis.documents_processed || 0}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600 font-medium mb-1">Failed</p>
                  <p className="text-2xl font-bold text-red-700">{analysisResults.analysis.document_analysis.documents_failed || 0}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium mb-1">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-700">{analysisResults.analysis.document_analysis.processing_success_rate || 0}%</p>
                </div>
              </div>
            )}

            {/* AI Key Requirements */}
            {analysisResults.analysis.ai_insights?.key_requirements && analysisResults.analysis.ai_insights.key_requirements.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Key Requirements</h3>
                <ul className="space-y-2">
                  {analysisResults.analysis.ai_insights.key_requirements.map((req: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Win Strategies */}
            {analysisResults.analysis.ai_insights?.win_strategies && analysisResults.analysis.ai_insights.win_strategies.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Win Strategies</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysisResults.analysis.ai_insights.win_strategies.map((strategy: string, i: number) => (
                    <div key={i} className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-sm text-green-800">{strategy}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Potential Challenges */}
            {analysisResults.analysis.ai_insights?.potential_challenges && analysisResults.analysis.ai_insights.potential_challenges.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Potential Challenges</h3>
                <div className="space-y-2">
                  {analysisResults.analysis.ai_insights.potential_challenges.map((challenge: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-800">{challenge}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommended Actions */}
            {analysisResults.analysis.ai_insights?.recommended_actions && analysisResults.analysis.ai_insights.recommended_actions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Recommended Actions</h3>
                <ol className="space-y-2">
                  {analysisResults.analysis.ai_insights.recommended_actions.map((action: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium flex-shrink-0">
                        {i + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Key Terms */}
            {analysisResults.analysis.content_insights?.key_terms?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Key Terms</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResults.analysis.content_insights.key_terms.map((term: { term: string; frequency: number }, i: number) => (
                    <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full">
                      {term.term} ({term.frequency})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysisResults.analysis.recommendations?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">System Recommendations</h3>
                <div className="space-y-3">
                  {analysisResults.analysis.recommendations.map((rec: { type: string; title: string; message: string }, i: number) => (
                    <div key={i} className={`p-4 rounded-lg border ${
                      rec.type === 'success' ? 'bg-green-50 border-green-200' :
                      rec.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                      rec.type === 'error' ? 'bg-red-50 border-red-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start gap-3">
                        {rec.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                         rec.type === 'warning' ? <AlertCircle className="h-5 w-5 text-yellow-600" /> :
                         rec.type === 'error' ? <XCircle className="h-5 w-5 text-red-600" /> :
                         <AlertCircle className="h-5 w-5 text-blue-600" />}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{rec.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{rec.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 pt-4 border-t border-gray-100">
              Analysis completed: {analysisResults.analyzed_at ? new Date(analysisResults.analyzed_at).toLocaleString() : 'Unknown'}
              {analysisResults.ai_powered && ' • Powered by OpenRouter AI'}
            </p>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {analyzeMutation.isSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Contract analysis completed successfully!
          </p>
        </div>
      )}

      {analyzeMutation.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Error: {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : 'Analysis failed'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ContractDetail;
