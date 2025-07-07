import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { RFPResponse } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPResponses: React.FC = () => {
  const [responses, setResponses] = useState<RFPResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await apiService.getRFPResponses(page, 20);
      if (response.success) {
        setResponses(response.responses);
        setPagination(response.pagination);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFP Responses</h1>
          <p className="text-gray-600">View and manage all your RFP responses</p>
        </div>
        <Link
          to="/rfp/generate"
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
        >
          Generate New RFP
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Responses List */}
      <div className="bg-white shadow rounded-lg">
        {responses.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {responses.map((response) => (
              <div key={response.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Link
                      to={`/rfp/responses/${response.id}`}
                      className="text-lg font-medium text-gray-900 hover:text-blue-600"
                    >
                      {response.title}
                    </Link>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Contract: {response.contractId}</span>
                      <span>•</span>
                      <span>Created: {new Date(response.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Updated: {new Date(response.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {response.metadata && (
                      <div className="mt-2 text-sm text-gray-600">
                        Word Count: {response.metadata.wordCount || 0} | 
                        Pages: {response.metadata.pageCount || 0}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      response.status === 'submitted' ? 'bg-green-100 text-green-800' :
                      response.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
                      response.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {response.status.replace('_', ' ')}
                    </span>
                    {response.predictedScore && (
                      <span className="text-sm font-medium text-gray-900">
                        Score: {typeof response.predictedScore === 'number' ? Math.round(response.predictedScore) : Math.round(response.predictedScore.overall)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No RFP responses</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by generating your first RFP response.</p>
            <div className="mt-6">
              <Link
                to="/rfp/generate"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Generate RFP Response
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <nav className="flex space-x-2">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => loadResponses(page)}
                className={`px-3 py-2 text-sm rounded-md ${
                  page === pagination.page
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
};

export default RFPResponses;
