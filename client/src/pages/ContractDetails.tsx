import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { Contract, ContractAnalysis } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const ContractDetails: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const [analysisResults, setAnalysisResults] = useState<ContractAnalysis | null>(null);
  const queryClient = useQueryClient();

  // Fetch contract details
  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => apiService.getContract(contractId!),
    enabled: !!contractId,
  });

  // Analyze contract mutation
  const analyzeContractMutation = useMutation({
    mutationFn: () => apiService.analyzeContract(contractId!),
    onSuccess: (data) => {
      setAnalysisResults(data);
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
    },
    onError: (error: any) => {
      console.error('Contract analysis error:', error);
    },
  });

  const handleAnalyzeContract = () => {
    analyzeContractMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !contract) {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{contract.title}</h1>
            <p className="mt-2 text-gray-600">Notice ID: {contract.noticeId}</p>
          </div>
          <button
            onClick={handleAnalyzeContract}
            disabled={analyzeContractMutation.isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {analyzeContractMutation.isPending ? <LoadingSpinner size="sm" /> : 'Analyze Contract'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Contract Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contract Details</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Agency</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.agency || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">NAICS Code</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.naicsCode || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Classification Code</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.classificationCode || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Posted Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {contract.postedDate ? new Date(contract.postedDate).toLocaleDateString() : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Set Aside Code</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.setAsideCode || 'N/A'}</dd>
            </div>
          </dl>
        </div>

        {/* Description */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
          <p className="text-sm text-gray-700">
            {contract.description || 'No description available.'}
          </p>
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

      {/* Downloaded Files */}
      {contract.documents?.downloaded_files && contract.documents.downloaded_files.length > 0 && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📁 Downloaded Files</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modified</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contract.documents.downloaded_files.map((file, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{file.filename}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{file.size_mb} MB</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {file.extension}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(file.modified).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Processing Queue */}
      {contract.documents?.processing_queue && contract.documents.processing_queue.length > 0 && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">⚙️ Processing Queue</h2>
          <div className="space-y-4">
            {contract.documents.processing_queue.map((doc) => (
              <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{doc.filename}</h4>
                    <div className="text-sm text-gray-500">
                      Status: <span className={`font-medium ${
                        doc.status === 'completed' ? 'text-green-600' :
                        doc.status === 'processing' ? 'text-yellow-600' :
                        doc.status === 'failed' ? 'text-red-600' :
                        'text-blue-600'
                      }`}>{doc.status}</span>
                      {doc.is_local_file && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          📁 Local File
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {doc.has_processed_data && doc.processed_data_preview && (
                  <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    <strong>Processed Data Preview:</strong> {doc.processed_data_preview}
                  </div>
                )}
                
                {doc.error_message && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                    <strong>Error:</strong> {doc.error_message}
                  </div>
                )}
                
                <div className="mt-2 text-xs text-gray-500">
                  Queued: {new Date(doc.queued_at).toLocaleString()}
                  {doc.completed_at && ` • Completed: ${new Date(doc.completed_at).toLocaleString()}`}
                  {doc.failed_at && ` • Failed: ${new Date(doc.failed_at).toLocaleString()}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResults && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🔍 Contract Analysis Results</h2>
          
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
                ))}
              </div>
            </div>
          )}

          {/* Key Terms */}
          {analysisResults.analysis.content_insights.key_terms.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Key Terms</h3>
              <div className="flex flex-wrap gap-2">
                {analysisResults.analysis.content_insights.key_terms.map((term, index) => (
                  <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                    {term.term} ({term.frequency})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Document Summaries */}
          {analysisResults.analysis.content_insights.document_summaries.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Document Summaries</h3>
              <div className="space-y-4">
                {analysisResults.analysis.content_insights.document_summaries.map((summary, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">{summary.filename}</h4>
                    <p className="text-sm text-gray-600 mt-1">{summary.summary}</p>
                    <div className="text-xs text-gray-500 mt-2">
                      {summary.word_count} words
                      {summary.key_points.length > 0 && (
                        <span className="ml-2">• Key points: {summary.key_points.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-4 text-xs text-gray-500">
            Analysis completed: {new Date(analysisResults.analyzed_at).toLocaleString()}
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {analyzeContractMutation.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Contract analysis completed successfully!</div>
        </div>
      )}

      {analyzeContractMutation.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Analysis error: {analyzeContractMutation.error instanceof Error ? analyzeContractMutation.error.message : 'Unknown error'}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractDetails;
