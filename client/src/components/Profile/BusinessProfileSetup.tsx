import React, { useState, useEffect } from 'react';
import { Building, Users, DollarSign, Shield, MapPin, Award, Save, Plus, X } from 'lucide-react';

interface BusinessProfile {
  id?: string;
  companyName: string;
  naicsCodes: string[];
  capabilities: string[];
  certifications: Record<string, any>;
  pastPerformance: Record<string, any>;
  geographicPreferences: Record<string, any>;
  annualRevenue?: number;
  employeeCount?: number;
  securityClearanceLevel?: string;
}

interface CompletionStatus {
  completionPercentage: number;
  missingFields: string[];
  recommendations: string[];
}

const BusinessProfileSetup: React.FC = () => {
  const [profile, setProfile] = useState<BusinessProfile>({
    companyName: '',
    naicsCodes: [],
    capabilities: [],
    certifications: {},
    pastPerformance: {},
    geographicPreferences: {}
  });

  const [completion, setCompletion] = useState<CompletionStatus>({
    completionPercentage: 0,
    missingFields: [],
    recommendations: []
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [newCapability, setNewCapability] = useState('');
  const [newNaicsCode, setNewNaicsCode] = useState('');

  const securityClearanceLevels = [
    'None',
    'Public Trust',
    'Secret',
    'Top Secret',
    'Top Secret/SCI'
  ];

  const commonNaicsCodes = [
    { code: '541511', description: 'Custom Computer Programming Services' },
    { code: '541512', description: 'Computer Systems Design Services' },
    { code: '541513', description: 'Computer Facilities Management Services' },
    { code: '541519', description: 'Other Computer Related Services' },
    { code: '541611', description: 'Administrative Management and General Management Consulting Services' },
    { code: '541618', description: 'Other Management Consulting Services' },
    { code: '541990', description: 'All Other Professional, Scientific, and Technical Services' }
  ];

  useEffect(() => {
    loadProfile();
    loadCompletion();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      } else if (response.status !== 404) {
        console.error('Failed to load profile');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompletion = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles/completion', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCompletion(data);
      }
    } catch (error) {
      console.error('Error loading completion status:', error);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        loadCompletion(); // Refresh completion status
        alert('Profile saved successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to save profile: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const addCapability = () => {
    if (newCapability.trim() && !profile.capabilities.includes(newCapability.trim())) {
      setProfile({
        ...profile,
        capabilities: [...profile.capabilities, newCapability.trim()]
      });
      setNewCapability('');
    }
  };

  const removeCapability = (index: number) => {
    setProfile({
      ...profile,
      capabilities: profile.capabilities.filter((_, i) => i !== index)
    });
  };

  const addNaicsCode = () => {
    if (newNaicsCode.trim() && !profile.naicsCodes.includes(newNaicsCode.trim())) {
      setProfile({
        ...profile,
        naicsCodes: [...profile.naicsCodes, newNaicsCode.trim()]
      });
      setNewNaicsCode('');
    }
  };

  const removeNaicsCode = (index: number) => {
    setProfile({
      ...profile,
      naicsCodes: profile.naicsCodes.filter((_, i) => i !== index)
    });
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Building },
    { id: 'capabilities', label: 'Capabilities', icon: Award },
    { id: 'certifications', label: 'Certifications', icon: Shield },
    { id: 'performance', label: 'Past Performance', icon: Users },
    { id: 'preferences', label: 'Preferences', icon: MapPin }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Profile Setup</h1>
        <p className="text-gray-600">
          Complete your business profile to receive personalized contract recommendations
        </p>
      </div>

      {/* Completion Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Profile Completion</h2>
          <span className="text-2xl font-bold text-blue-600">
            {completion.completionPercentage}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${completion.completionPercentage}%` }}
          ></div>
        </div>

        {completion.recommendations.length > 0 && (
          <div className="space-y-2">
            {completion.recommendations.map((rec, index) => (
              <p key={index} className="text-sm text-gray-600">• {rec}</p>
            ))}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={profile.companyName}
                  onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your company name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Annual Revenue
                  </label>
                  <input
                    type="number"
                    value={profile.annualRevenue || ''}
                    onChange={(e) => setProfile({ ...profile, annualRevenue: parseInt(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter annual revenue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee Count
                  </label>
                  <input
                    type="number"
                    value={profile.employeeCount || ''}
                    onChange={(e) => setProfile({ ...profile, employeeCount: parseInt(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Number of employees"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Security Clearance Level
                </label>
                <select
                  value={profile.securityClearanceLevel || ''}
                  onChange={(e) => setProfile({ ...profile, securityClearanceLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select clearance level</option>
                  {securityClearanceLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* NAICS Codes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NAICS Codes
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newNaicsCode}
                    onChange={(e) => setNewNaicsCode(e.target.value)}
                    placeholder="Enter NAICS code"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addNaicsCode}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>

                {/* Common NAICS Codes */}
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-2">Common NAICS codes:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {commonNaicsCodes.map((naics) => (
                      <button
                        key={naics.code}
                        type="button"
                        onClick={() => {
                          if (!profile.naicsCodes.includes(naics.code)) {
                            setProfile({
                              ...profile,
                              naicsCodes: [...profile.naicsCodes, naics.code]
                            });
                          }
                        }}
                        className="text-left p-2 border border-gray-200 rounded hover:bg-gray-50 text-sm"
                      >
                        <div className="font-medium">{naics.code}</div>
                        <div className="text-gray-600">{naics.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected NAICS Codes */}
                {profile.naicsCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.naicsCodes.map((code, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {code}
                        <button
                          type="button"
                          onClick={() => removeNaicsCode(index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Capabilities Tab */}
          {activeTab === 'capabilities' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Core Capabilities
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  List your company's key capabilities and services
                </p>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newCapability}
                    onChange={(e) => setNewCapability(e.target.value)}
                    placeholder="Enter a capability"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addCapability()}
                  />
                  <button
                    type="button"
                    onClick={addCapability}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>

                {profile.capabilities.length > 0 && (
                  <div className="space-y-2">
                    {profile.capabilities.map((capability, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-md"
                      >
                        <span>{capability}</span>
                        <button
                          type="button"
                          onClick={() => removeCapability(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other tabs would be implemented similarly */}
          {activeTab === 'certifications' && (
            <div className="text-center py-8 text-gray-500">
              Certifications section - Coming soon
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="text-center py-8 text-gray-500">
              Past Performance section - Coming soon
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="text-center py-8 text-gray-500">
              Geographic Preferences section - Coming soon
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={saveProfile}
            disabled={saving || !profile.companyName}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessProfileSetup;
