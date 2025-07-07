import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { RFPResponse } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPResponseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rfpResponse, setRfpResponse] = useState<RFPResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadRFPResponse(Number(id));
    }
  }, [id]);

  const loadRFPResponse = async (responseId: number) => {
    try {
      setLoading(true);
      const response = await apiService.getRFPResponse(responseId);
      if (response.success) {
        setRfpResponse(response.response);
      } else {
        setError('Failed to load RFP response');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!rfpResponse) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium text-gray-900">RFP Response Not Found</h3>
        <p className="text-gray-500 mt-2">The requested RFP response could not be found.</p>
        <Link
          to="/rfp"
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{rfpResponse.title}</h1>
          <p className="text-gray-600 mt-1">Contract: {rfpResponse.contractId}</p>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              rfpResponse.status === 'submitted' ? 'bg-green-100 text-green-800' :
              rfpResponse.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
              rfpResponse.status === 'approved' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {rfpResponse.status.replace('_', ' ')}
            </span>
            <span>Updated: {new Date(rfpResponse.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/rfp"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
          <button 
            onClick={() => navigate(`/rfp/responses/${id}/edit`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Edit Response
          </button>
        </div>
      </div>

      {/* Predicted Score */}
      {rfpResponse.predictedScore && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Predicted Score</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {typeof rfpResponse.predictedScore === 'number' 
                  ? Math.round(rfpResponse.predictedScore) 
                  : Math.round(rfpResponse.predictedScore.overall)}
              </div>
              <div className="text-sm text-gray-500">Overall</div>
            </div>
            {typeof rfpResponse.predictedScore === 'object' && (
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(rfpResponse.predictedScore.technical)}
                  </div>
                  <div className="text-sm text-gray-500">Technical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {Math.round(rfpResponse.predictedScore.cost)}
                  </div>
                  <div className="text-sm text-gray-500">Cost</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(rfpResponse.predictedScore.pastPerformance)}
                  </div>
                  <div className="text-sm text-gray-500">Past Performance</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Compliance Status */}
      {rfpResponse.complianceStatus && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Status</h3>
          <div className="flex items-center space-x-4">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              rfpResponse.complianceStatus.overall 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {rfpResponse.complianceStatus.overall ? '✅ Compliant' : '❌ Non-Compliant'}
            </div>
            <span className="text-sm text-gray-500">
              Score: {Math.round(rfpResponse.complianceStatus.score)}%
            </span>
          </div>
          {rfpResponse.complianceStatus.issues && rfpResponse.complianceStatus.issues.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Issues:</h4>
              <ul className="space-y-1">
                {rfpResponse.complianceStatus.issues.map((issue, index) => (
                  <li key={index} className="text-sm text-red-600">
                    • {issue.message || 'Compliance issue'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Response Sections</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {rfpResponse.sections && rfpResponse.sections.length > 0 ? (
            rfpResponse.sections.map((section, index) => (
              <div key={section.id} className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    section.status === 'approved' ? 'bg-green-100 text-green-800' :
                    section.status === 'reviewed' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {section.status}
                  </span>
                </div>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <span>Word count: {section.wordCount}</span>
                  <span>Last modified: {new Date(section.lastModified).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No sections available</h3>
              <p className="mt-1 text-sm text-gray-500">
                This RFP response appears to be incomplete. The generation process may not have finished properly.
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Possible reasons:</strong>
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>The RFP generation process is still running</li>
                  <li>The selected template had no sections defined</li>
                  <li>There was an error during generation</li>
                  <li>The company profile data wasn't properly used</li>
                </ul>
                <div className="mt-4">
                  <button 
                    onClick={() => navigate(`/rfp/responses/${id}/edit`)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Edit Response
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RFPResponseDetail;
