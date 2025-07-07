import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { CompanyProfile, CompanyProfileForm } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const CompanyProfiles: React.FC = () => {
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<CompanyProfileForm>({
    companyName: '',
    basicInfo: {
      dunsNumber: '',
      cageCode: '',
      certifications: [],
      sizeStandard: '',
      naicsCode: []
    },
    capabilities: {
      coreCompetencies: [],
      technicalSkills: [],
      securityClearances: [],
      methodologies: []
    },
    pastPerformance: [],
    keyPersonnel: []
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCompanyProfiles();
      if (response.success) {
        setProfiles(response.profiles);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const response = await apiService.createCompanyProfile(formData);
      if (response.success) {
        setProfiles([...profiles, response.profile]);
        setShowCreateForm(false);
        resetForm();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      companyName: '',
      basicInfo: {
        dunsNumber: '',
        cageCode: '',
        certifications: [],
        sizeStandard: '',
        naicsCode: []
      },
      capabilities: {
        coreCompetencies: [],
        technicalSkills: [],
        securityClearances: [],
        methodologies: []
      },
      pastPerformance: [],
      keyPersonnel: []
    });
  };

  const addToArray = (field: string, subField?: string) => {
    if (subField) {
      if (field === 'basicInfo') {
        setFormData(prev => ({
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            [subField]: [...(prev.basicInfo as any)[subField], '']
          }
        }));
      } else if (field === 'capabilities') {
        setFormData(prev => ({
          ...prev,
          capabilities: {
            ...prev.capabilities,
            [subField]: [...(prev.capabilities as any)[subField], '']
          }
        }));
      }
    }
  };

  const updateArrayItem = (field: string, index: number, value: string, subField?: string) => {
    if (subField) {
      if (field === 'basicInfo') {
        const updatedArray = [...(formData.basicInfo as any)[subField]];
        updatedArray[index] = value;
        setFormData(prev => ({
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            [subField]: updatedArray
          }
        }));
      } else if (field === 'capabilities') {
        const updatedArray = [...(formData.capabilities as any)[subField]];
        updatedArray[index] = value;
        setFormData(prev => ({
          ...prev,
          capabilities: {
            ...prev.capabilities,
            [subField]: updatedArray
          }
        }));
      }
    }
  };

  const removeFromArray = (field: string, index: number, subField?: string) => {
    if (subField) {
      if (field === 'basicInfo') {
        const updatedArray = (formData.basicInfo as any)[subField].filter((_: any, i: number) => i !== index);
        setFormData(prev => ({
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            [subField]: updatedArray
          }
        }));
      } else if (field === 'capabilities') {
        const updatedArray = (formData.capabilities as any)[subField].filter((_: any, i: number) => i !== index);
        setFormData(prev => ({
          ...prev,
          capabilities: {
            ...prev.capabilities,
            [subField]: updatedArray
          }
        }));
      }
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
          <h1 className="text-2xl font-bold text-gray-900">Company Profiles</h1>
          <p className="text-gray-600">Manage your company information for RFP responses</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Profile
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Profiles List */}
      <div className="bg-white shadow rounded-lg">
        {profiles.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {profiles.map((profile) => (
              <div key={profile.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {profile.companyName}
                    </h3>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">DUNS:</span> {profile.basicInfo?.dunsNumber || 'Not provided'}
                      </div>
                      <div>
                        <span className="font-medium">CAGE Code:</span> {profile.basicInfo?.cageCode || 'Not provided'}
                      </div>
                      <div>
                        <span className="font-medium">Size Standard:</span> {profile.basicInfo?.sizeStandard || 'Not provided'}
                      </div>
                      <div>
                        <span className="font-medium">Certifications:</span> {profile.basicInfo?.certifications?.join(', ') || 'None'}
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="font-medium text-sm text-gray-600">Core Competencies:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {profile.capabilities?.coreCompetencies?.map((competency: string, index: number) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {competency}
                          </span>
                        )) || <span className="text-gray-400 text-sm">None specified</span>}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      Edit
                    </button>
                    <button className="text-red-600 hover:text-red-800 text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No company profiles</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first company profile.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Company Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Create Company Profile</h3>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DUNS Number
                    </label>
                    <input
                      type="text"
                      value={formData.basicInfo.dunsNumber}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        basicInfo: { ...prev.basicInfo, dunsNumber: e.target.value }
                      }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter DUNS number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CAGE Code
                    </label>
                    <input
                      type="text"
                      value={formData.basicInfo.cageCode}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        basicInfo: { ...prev.basicInfo, cageCode: e.target.value }
                      }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter CAGE code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Size Standard
                    </label>
                    <select
                      value={formData.basicInfo.sizeStandard}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        basicInfo: { ...prev.basicInfo, sizeStandard: e.target.value }
                      }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select size standard</option>
                      <option value="Small Business">Small Business</option>
                      <option value="Large Business">Large Business</option>
                      <option value="8(a) Small Disadvantaged Business">8(a) Small Disadvantaged Business</option>
                      <option value="HUBZone Small Business">HUBZone Small Business</option>
                      <option value="Service-Disabled Veteran-Owned Small Business">Service-Disabled Veteran-Owned Small Business</option>
                      <option value="Women-Owned Small Business">Women-Owned Small Business</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* NAICS Codes */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">NAICS Codes</h4>
                <div className="space-y-2">
                  {formData.basicInfo.naicsCode.map((naics, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={naics}
                        onChange={(e) => updateArrayItem('basicInfo', index, e.target.value, 'naicsCode')}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter NAICS code (e.g., 541511)"
                      />
                      <button
                        onClick={() => removeFromArray('basicInfo', index, 'naicsCode')}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addToArray('basicInfo', 'naicsCode')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + Add NAICS Code
                  </button>
                </div>
              </div>

              {/* Core Competencies */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Core Competencies</h4>
                <div className="space-y-2">
                  {formData.capabilities.coreCompetencies.map((competency, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={competency}
                        onChange={(e) => updateArrayItem('capabilities', index, e.target.value, 'coreCompetencies')}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter core competency"
                      />
                      <button
                        onClick={() => removeFromArray('capabilities', index, 'coreCompetencies')}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addToArray('capabilities', 'coreCompetencies')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + Add Core Competency
                  </button>
                </div>
              </div>

              {/* Technical Skills */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Technical Skills</h4>
                <div className="space-y-2">
                  {formData.capabilities.technicalSkills.map((skill: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={skill}
                        onChange={(e) => updateArrayItem('capabilities', index, e.target.value, 'technicalSkills')}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter technical skill"
                      />
                      <button
                        onClick={() => removeFromArray('capabilities', index, 'technicalSkills')}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addToArray('capabilities', 'technicalSkills')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + Add Technical Skill
                  </button>
                </div>
              </div>

              {/* Methodologies */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Methodologies</h4>
                <div className="space-y-2">
                  {formData.capabilities.methodologies.map((methodology: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={methodology}
                        onChange={(e) => updateArrayItem('capabilities', index, e.target.value, 'methodologies')}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter methodology (e.g., Agile, DevOps)"
                      />
                      <button
                        onClick={() => removeFromArray('capabilities', index, 'methodologies')}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addToArray('capabilities', 'methodologies')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + Add Methodology
                  </button>
                </div>
              </div>

              {/* Certifications */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Certifications</h4>
                <div className="space-y-2">
                  {formData.basicInfo.certifications.map((certification, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={certification}
                        onChange={(e) => updateArrayItem('basicInfo', index, e.target.value, 'certifications')}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter certification"
                      />
                      <button
                        onClick={() => removeFromArray('basicInfo', index, 'certifications')}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addToArray('basicInfo', 'certifications')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + Add Certification
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-red-800">{error}</div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                  setError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProfile}
                disabled={creating || !formData.companyName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {creating && <LoadingSpinner size="sm" className="mr-2" />}
                {creating ? 'Creating...' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfiles;
