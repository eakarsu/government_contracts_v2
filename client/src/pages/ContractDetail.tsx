import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { Contract, ContractAnalysis } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

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
      console.log('🔍 [DEBUG] Analysis results received:', data);
      console.log('🔍 [DEBUG] Analysis data structure:', JSON.stringify(data, null, 2));
      setAnalysisResults(data);
      queryClient.invalidateQueries({ queryKey: ['contract', noticeId] });
    },
    onError: (error: any) => {
      console.error('Contract analysis error:', error);
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">
            Error loading contract: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Contract not found</h2>
          <p className="mt-2 text-gray-600">
            The contract with notice ID "{noticeId}" could not be found.
          </p>
          <Link
            to="/contracts"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Contracts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li>
              <Link to="/contracts" className="text-gray-400 hover:text-gray-500">
                Contracts
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg
                  className="flex-shrink-0 h-5 w-5 text-gray-300"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="ml-4 text-sm font-medium text-gray-500">
                  {contract.noticeId}
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {contract.title || 'Untitled Contract'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">Notice ID: {contract.noticeId}</p>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {analyzeMutation.isPending ? <LoadingSpinner size="sm" /> : 'Analyze Contract'}
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contract Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Agency</dt>
                  <dd className="text-sm text-gray-900">{contract.agency || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">NAICS Code</dt>
                  <dd className="text-sm text-gray-900">{contract.naicsCode || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Classification Code</dt>
                  <dd className="text-sm text-gray-900">{contract.classificationCode || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Posted Date</dt>
                  <dd className="text-sm text-gray-900">{formatDate(contract.postedDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Set Aside Code</dt>
                  <dd className="text-sm text-gray-900">{contract.setAsideCode || 'N/A'}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Description</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {contract.description || 'No description available.'}
              </div>
            </div>
          </div>

          {/* Document Statistics */}
          {contract.statistics && (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Document Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{contract.statistics.total_resource_links}</div>
                  <div className="text-sm text-blue-600">Resource Links</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{contract.statistics.downloaded_files_count}</div>
                  <div className="text-sm text-green-600">Downloaded</div>
                  <div className="text-xs text-gray-500">{contract.statistics.download_completion_rate}% complete</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{contract.statistics.documents_in_queue}</div>
                  <div className="text-sm text-purple-600">In Queue</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{contract.statistics.completed_documents}</div>
                  <div className="text-sm text-yellow-600">Processed</div>
                  <div className="text-xs text-gray-500">{contract.statistics.processing_completion_rate}% success</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{contract.statistics.documents_in_vector_db}</div>
                  <div className="text-sm text-indigo-600">Searchable</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{contract.statistics.failed_documents}</div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>
            </div>
          )}

          {/* Resource Links Analysis */}
          {contract.documents?.resource_links_analysis && contract.documents.resource_links_analysis.length > 0 && (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🔗 Resource Links</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloaded</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Queue Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {contract.documents.resource_links_analysis.map((link) => (
                      <tr key={link.index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{link.index}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{link.filename}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {link.extension || 'unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {link.is_downloaded ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✅ Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ❌ No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            link.queue_status === 'completed' ? 'bg-green-100 text-green-800' :
                            link.queue_status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            link.queue_status === 'failed' ? 'bg-red-100 text-red-800' :
                            link.queue_status === 'queued' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {link.queue_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-800 truncate block max-w-xs"
                          >
                            {link.url}
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
          {analysisResults && analysisResults.analysis && (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🔍 Contract Analysis Results</h2>
              
              {/* Contract Overview */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Contract Overview</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">NAICS Code:</span>
                      <div className="text-sm text-gray-900">{analysisResults.analysis.contract_overview.naics_code || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Classification:</span>
                      <div className="text-sm text-gray-900">{analysisResults.analysis.contract_overview.classification || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Set Aside:</span>
                      <div className="text-sm text-gray-900">{analysisResults.analysis.contract_overview.set_aside || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Description Length:</span>
                      <div className="text-sm text-gray-900">{analysisResults.analysis.contract_overview.description_length} characters</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Has Description:</span>
                      <div className="text-sm text-gray-900">{analysisResults.analysis.contract_overview.has_description ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Posted Date:</span>
                      <div className="text-sm text-gray-900">
                        {analysisResults.analysis.contract_overview.posted_date 
                          ? new Date(analysisResults.analysis.contract_overview.posted_date).toLocaleDateString()
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Analysis */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Document Analysis</h3>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-sm font-medium text-blue-700">Resource Links:</span>
                      <div className="text-lg font-bold text-blue-900">{analysisResults.analysis.document_analysis.total_resource_links}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-700">Processed:</span>
                      <div className="text-lg font-bold text-blue-900">{analysisResults.analysis.document_analysis.documents_processed}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-700">Failed:</span>
                      <div className="text-lg font-bold text-blue-900">{analysisResults.analysis.document_analysis.documents_failed}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-700">Success Rate:</span>
                      <div className="text-lg font-bold text-blue-900">{analysisResults.analysis.document_analysis.processing_success_rate}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {analysisResults.analysis.recommendations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Recommendations</h3>
                  <div className="space-y-3">
                    {analysisResults.analysis.recommendations.map((rec, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        rec.type === 'success' ? 'bg-green-50 border-green-200' :
                        rec.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                        rec.type === 'error' ? 'bg-red-50 border-red-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-start">
                          <div className={`flex-shrink-0 mr-3 mt-0.5 ${
                            rec.type === 'success' ? 'text-green-500' :
                            rec.type === 'warning' ? 'text-yellow-500' :
                            rec.type === 'error' ? 'text-red-500' :
                            'text-blue-500'
                          }`}>
                            {rec.type === 'success' ? '✅' :
                             rec.type === 'warning' ? '⚠️' :
                             rec.type === 'error' ? '❌' :
                             'ℹ️'}
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-medium ${
                              rec.type === 'success' ? 'text-green-800' :
                              rec.type === 'warning' ? 'text-yellow-800' :
                              rec.type === 'error' ? 'text-red-800' :
                              'text-blue-800'
                            }`}>{rec.title}</h4>
                            <p className={`text-sm mt-1 ${
                              rec.type === 'success' ? 'text-green-700' :
                              rec.type === 'warning' ? 'text-yellow-700' :
                              rec.type === 'error' ? 'text-red-700' :
                              'text-blue-700'
                            }`}>{rec.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
                Analysis completed: {new Date(analysisResults.analyzed_at).toLocaleString()}
              </div>
            </div>
          )}

          {/* Success/Error Messages */}
          {analyzeMutation.isSuccess && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="text-green-800">
                Contract analysis completed successfully!
                {analysisResults && analysisResults.analysis ? ' Analysis results are displayed above.' : ' Waiting for results to load...'}
              </div>
              {/* Debug info */}
              <details className="mt-2">
                <summary className="text-xs text-green-600 cursor-pointer">Debug: Raw Analysis Data</summary>
                <pre className="text-xs text-green-700 mt-1 overflow-auto max-h-32">
                  {JSON.stringify(analysisResults, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {!!analyzeMutation.error && (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-800">
                Error analyzing contract: {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : String(analyzeMutation.error)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractDetail;
