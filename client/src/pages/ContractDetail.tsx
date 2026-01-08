import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  ChevronRight,
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
  Sparkles
} from 'lucide-react';
import { apiService } from '../services/api';
import { ContractAnalysis } from '../types';

const ContractDetail: React.FC = () => {
  const { noticeId } = useParams<{ noticeId: string }>();
  const [analysisResults, setAnalysisResults] = useState<ContractAnalysis | null>(null);
  const queryClient = useQueryClient();

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['contract', noticeId],
    queryFn: () => apiService.getContract(noticeId!),
    enabled: !!noticeId,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiService.analyzeContract(noticeId!),
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
          <Link to="/contracts" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Back to Contracts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/contracts" className="hover:text-gray-700">Contracts</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{contract.noticeId}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              {contract.title || 'Untitled Contract'}
            </h1>
            <p className="text-sm text-gray-500">Notice ID: {contract.noticeId}</p>
          </div>
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {analyzeMutation.isPending ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Analyze Contract</>
            )}
          </button>
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
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {contract.description || 'No description available.'}
              </p>
            </div>
          </div>
        </div>
      </div>

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
              AI Analysis Results
            </h2>
          </div>
          <div className="p-6 space-y-6">
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

            {/* Key Terms */}
            {analysisResults.analysis.content_insights?.key_terms?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Key Terms</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResults.analysis.content_insights.key_terms.map((term, i) => (
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
                <h3 className="text-sm font-medium text-gray-700 mb-3">Recommendations</h3>
                <div className="space-y-3">
                  {analysisResults.analysis.recommendations.map((rec, i) => (
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
