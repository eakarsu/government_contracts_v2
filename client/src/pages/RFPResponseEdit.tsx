import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { RFPResponse, RFPResponseSection } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPResponseEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rfpResponse, setRfpResponse] = useState<RFPResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionContent, setSectionContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'sections' | 'fulltext'>('sections');

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

  const handleEditSection = (section: RFPResponseSection) => {
    setEditingSection(section.id);
    setSectionContent(section.content);
  };

  const handleSaveSection = async () => {
    if (!editingSection || !rfpResponse) return;

    try {
      setSaving(true);
      const response = await apiService.updateRFPSection(rfpResponse.id, editingSection, {
        content: sectionContent
      });
      
      if (response.success) {
        // Update the local state
        setRfpResponse(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            sections: prev.sections?.map(section => 
              section.id === editingSection 
                ? { ...section, content: sectionContent, wordCount: sectionContent.split(' ').length }
                : section
            ) || []
          };
        });
        setEditingSection(null);
        setSectionContent('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setSectionContent('');
  };

  const handleRegenerateSection = async (sectionId: string) => {
    if (!rfpResponse) return;

    try {
      setSaving(true);
      const response = await apiService.regenerateRFPSection(rfpResponse.id, sectionId);
      
      if (response.success) {
        // Update the local state
        setRfpResponse(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            sections: prev.sections?.map(section => 
              section.id === sectionId ? response.section : section
            ) || []
          };
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Edit RFP Response</h1>
          <h2 className="text-lg text-gray-700 mt-1">{rfpResponse.title}</h2>
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
          <button
            onClick={() => setViewMode(viewMode === 'sections' ? 'fulltext' : 'sections')}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            {viewMode === 'sections' ? '📄 Show Full Text' : '📝 Show Sections'}
          </button>
          <Link
            to={`/rfp/responses/${id}`}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            View Response
          </Link>
          <Link
            to="/rfp"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Full Text View */}
      {viewMode === 'fulltext' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">📄 Full Text Version</h2>
            <p className="text-sm text-gray-500 mt-1">Complete text content of your RFP response</p>
          </div>
          <div className="p-6">
            <div className="bg-gray-50 border rounded-lg p-6">
              <div className="prose max-w-none">
                <h1 className="text-2xl font-bold mb-4">{rfpResponse.title}</h1>
                <div className="text-sm text-gray-600 mb-6">
                  <strong>Contract:</strong> {rfpResponse.contractId}<br/>
                  <strong>Generated:</strong> {new Date(rfpResponse.createdAt).toLocaleDateString()}<br/>
                  <strong>Last Updated:</strong> {new Date(rfpResponse.updatedAt).toLocaleDateString()}
                </div>
                
                {rfpResponse.sections && rfpResponse.sections.length > 0 ? (
                  rfpResponse.sections.map((section, index) => (
                    <div key={section.id} className="mb-8">
                      <h2 className="text-xl font-semibold mb-3 text-gray-800">
                        {index + 1}. {section.title}
                      </h2>
                      <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {section.content || 'No content available for this section.'}
                      </div>
                      <div className="mt-2 text-xs text-gray-500 border-b border-gray-200 pb-2">
                        Word count: {section.wordCount || 0} | Status: {section.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">No sections available to display.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sections */}
      {viewMode === 'sections' && (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Response Sections</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {rfpResponse.sections && rfpResponse.sections.length > 0 ? (
            rfpResponse.sections.map((section) => (
              <div key={section.id} className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      section.status === 'approved' ? 'bg-green-100 text-green-800' :
                      section.status === 'reviewed' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {section.status}
                    </span>
                    {editingSection !== section.id && (
                      <>
                        <button
                          onClick={() => handleEditSection(section)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRegenerateSection(section.id)}
                          disabled={saving}
                          className="text-green-600 hover:text-green-800 text-sm disabled:opacity-50"
                        >
                          Regenerate
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {editingSection === section.id ? (
                  <div className="space-y-4">
                    <textarea
                      value={sectionContent}
                      onChange={(e) => setSectionContent(e.target.value)}
                      rows={10}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter section content..."
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Word count: {sectionContent.split(' ').filter(word => word.length > 0).length}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveSection}
                          disabled={saving}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center"
                        >
                          {saving && <LoadingSpinner size="sm" className="mr-1" />}
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="prose max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap">{section.content || 'No content available'}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                      <span>Word count: {section.wordCount}</span>
                      <span>Last modified: {new Date(section.lastModified).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No sections available</h3>
              <p className="mt-1 text-sm text-gray-500">
                This RFP response has no sections. This usually means the generation process didn't complete properly.
              </p>
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-4">
                  <strong>To fix this issue:</strong>
                </p>
                <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1 mb-4">
                  <li>Check that your RFP template has sections defined</li>
                  <li>Verify your company profile has complete information</li>
                  <li>Try regenerating the RFP response</li>
                </ol>
                <Link
                  to="/rfp/generate"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  Generate New RFP
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default RFPResponseEdit;
