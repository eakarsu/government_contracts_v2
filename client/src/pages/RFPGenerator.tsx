import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { Contract, RFPTemplate, CompanyProfile, RFPGenerationRequest } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPGenerator: React.FC = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<RFPTemplate[]>([]);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('');
  const [selectedProfile, setSelectedProfile] = useState<number | ''>('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contractsResponse, templatesResponse, profilesResponse] = await Promise.all([
        apiService.searchContracts({ query: '', limit: 100, include_analysis: false }),
        apiService.getRFPTemplates(),
        apiService.getCompanyProfiles()
      ]);

      if (contractsResponse.success) {
        setContracts(contractsResponse.results || []);
      }

      if (templatesResponse.success) {
        setTemplates(templatesResponse.templates || []);
      }

      if (profilesResponse.success) {
        setProfiles(profilesResponse.profiles || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedContract || !selectedTemplate || !selectedProfile) {
      setError('Please select a contract, template, and company profile');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const request: RFPGenerationRequest = {
        contractId: selectedContract,
        templateId: Number(selectedTemplate),
        companyProfileId: Number(selectedProfile),
        customInstructions: customInstructions || undefined,
        focusAreas: focusAreas.length > 0 ? focusAreas : undefined
      };

      const response = await apiService.generateRFPResponse(request);

      if (response.success) {
        // Navigate to the generated RFP response
        navigate(`/rfp/responses/${response.rfpResponseId}`);
      } else {
        setError('Failed to generate RFP response');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const addFocusArea = () => {
    setFocusAreas([...focusAreas, '']);
  };

  const updateFocusArea = (index: number, value: string) => {
    const updated = [...focusAreas];
    updated[index] = value;
    setFocusAreas(updated);
  };

  const removeFocusArea = (index: number) => {
    setFocusAreas(focusAreas.filter((_, i) => i !== index));
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate RFP Response</h1>
        <p className="text-gray-600">Create an AI-powered RFP response from a government contract</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-6">
          {/* Contract Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Contract
            </label>
            <select
              value={selectedContract}
              onChange={(e) => setSelectedContract(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a contract...</option>
              {contracts.map((contract) => (
                <option key={contract.noticeId} value={contract.noticeId}>
                  {contract.title} - {contract.agency}
                </option>
              ))}
            </select>
            {contracts.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">
                No contracts available. Please index some contracts first.
              </p>
            )}
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select RFP Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a template...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.agency}
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">
                No templates available. <button 
                  onClick={() => navigate('/rfp/templates')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Create one first
                </button>.
              </p>
            )}
          </div>

          {/* Company Profile Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Company Profile
            </label>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a company profile...</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.companyName}
                </option>
              ))}
            </select>
            {profiles.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">
                No company profiles available. <button 
                  onClick={() => navigate('/rfp/company-profiles')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Create one first
                </button>.
              </p>
            )}
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Instructions (Optional)
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any specific instructions for the AI to follow when generating the RFP response..."
            />
          </div>

          {/* Focus Areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Focus Areas (Optional)
            </label>
            <div className="space-y-2">
              {focusAreas.map((area, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => updateFocusArea(index, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Technical innovation, Cost effectiveness"
                  />
                  <button
                    onClick={() => removeFocusArea(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={addFocusArea}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Focus Area
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => navigate('/rfp')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedContract || !selectedTemplate || !selectedProfile}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {generating && <LoadingSpinner size="sm" className="mr-2" />}
              {generating ? 'Generating...' : 'Generate RFP Response'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RFPGenerator;
