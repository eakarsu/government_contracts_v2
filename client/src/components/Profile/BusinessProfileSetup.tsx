import React, { useState, useEffect } from 'react';
import { Building, Users, DollarSign, Shield, MapPin, Award, Save, Plus, X } from 'lucide-react';

interface BusinessProfile {
  id?: string;
  companyName: string;
  dunsNumber?: string;
  cageCode?: string;
  naicsCodes: string[];
  capabilities: string[];
  technicalSkills: string[];
  methodologies: string[];
  certifications: Record<string, any>;
  certificationsList: string[];
  pastPerformance: Record<string, any>;
  geographicPreferences: Record<string, any>;
  annualRevenue?: number;
  employeeCount?: number;
  securityClearanceLevel?: string;
}

// Sample data for pre-population
const SAMPLE_DATA: BusinessProfile = {
  companyName: 'TechGov Solutions LLC',
  dunsNumber: '123456789',
  cageCode: '5ABC1',
  naicsCodes: ['541511', '541512', '541519', '541611', '518210'],
  capabilities: [
    'Cloud Migration and Modernization',
    'Cybersecurity and Risk Management',
    'Enterprise Software Development',
    'Data Analytics and Business Intelligence',
    'IT Infrastructure Management',
    'Agile Project Management',
    'DevSecOps Implementation',
    'Artificial Intelligence and Machine Learning'
  ],
  technicalSkills: [
    'AWS / Azure / Google Cloud Platform',
    'Python, Java, JavaScript, TypeScript',
    'React, Angular, Node.js',
    'PostgreSQL, MongoDB, SQL Server',
    'Kubernetes, Docker, Terraform',
    'CI/CD Pipelines (Jenkins, GitLab)',
    'RESTful APIs and Microservices',
    'Machine Learning (TensorFlow, PyTorch)'
  ],
  methodologies: [
    'Agile/Scrum',
    'SAFe (Scaled Agile Framework)',
    'DevSecOps',
    'ITIL v4',
    'CMMI Level 3',
    'Lean Six Sigma',
    'Risk Management Framework (RMF)',
    'Human-Centered Design'
  ],
  certificationsList: [
    'ISO 9001:2015 Quality Management',
    'ISO 27001 Information Security',
    'SOC 2 Type II',
    'FedRAMP Authorized',
    'CMMI Level 3 Development',
    '8(a) Certified Small Business',
    'Service-Disabled Veteran-Owned (SDVOSB)',
    'GSA Schedule Contract Holder'
  ],
  certifications: {},
  pastPerformance: {},
  geographicPreferences: {},
  annualRevenue: 15000000,
  employeeCount: 75,
  securityClearanceLevel: 'Secret'
};

interface CompletionStatus {
  completionPercentage: number;
  missingFields: string[];
  recommendations: string[];
}

const BusinessProfileSetup: React.FC = () => {
  const [profile, setProfile] = useState<BusinessProfile>({
    companyName: '',
    dunsNumber: '',
    cageCode: '',
    naicsCodes: [],
    capabilities: [],
    technicalSkills: [],
    methodologies: [],
    certifications: {},
    certificationsList: [],
    pastPerformance: {},
    geographicPreferences: {}
  });

  const loadSampleData = () => {
    setProfile(SAMPLE_DATA);
  };

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
  const [newTechnicalSkill, setNewTechnicalSkill] = useState('');
  const [newMethodology, setNewMethodology] = useState('');
  const [newCertification, setNewCertification] = useState('');

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
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Profile Setup</h1>
          <p className="text-gray-600">
            Complete your business profile to receive personalized contract recommendations
          </p>
        </div>
        <button
          onClick={loadSampleData}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Load Sample Data
        </button>
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
                    DUNS Number
                  </label>
                  <input
                    type="text"
                    value={profile.dunsNumber || ''}
                    onChange={(e) => setProfile({ ...profile, dunsNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="9-digit DUNS number"
                    maxLength={9}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CAGE Code
                  </label>
                  <input
                    type="text"
                    value={profile.cageCode || ''}
                    onChange={(e) => setProfile({ ...profile, cageCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="5-character CAGE code"
                    maxLength={5}
                  />
                </div>
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
            <div className="space-y-8">
              {/* Core Capabilities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Core Competencies
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  List your company's key capabilities and services
                </p>

                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newCapability}
                    onChange={(e) => setNewCapability(e.target.value)}
                    placeholder="e.g., Cloud Migration and Modernization"
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
                  <div className="flex flex-wrap gap-2">
                    {profile.capabilities.map((capability, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {capability}
                        <button
                          type="button"
                          onClick={() => removeCapability(index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Technical Skills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Technical Skills
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Technologies, platforms, and tools your team is proficient in
                </p>

                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newTechnicalSkill}
                    onChange={(e) => setNewTechnicalSkill(e.target.value)}
                    placeholder="e.g., AWS / Azure / Google Cloud Platform"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newTechnicalSkill.trim()) {
                        setProfile({
                          ...profile,
                          technicalSkills: [...(profile.technicalSkills || []), newTechnicalSkill.trim()]
                        });
                        setNewTechnicalSkill('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTechnicalSkill.trim()) {
                        setProfile({
                          ...profile,
                          technicalSkills: [...(profile.technicalSkills || []), newTechnicalSkill.trim()]
                        });
                        setNewTechnicalSkill('');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>

                {profile.technicalSkills && profile.technicalSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.technicalSkills.map((skill, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => setProfile({
                            ...profile,
                            technicalSkills: profile.technicalSkills.filter((_, i) => i !== index)
                          })}
                          className="ml-2 text-green-600 hover:text-green-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Methodologies */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Methodologies
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Project management and development methodologies
                </p>

                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newMethodology}
                    onChange={(e) => setNewMethodology(e.target.value)}
                    placeholder="e.g., Agile/Scrum, DevSecOps"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newMethodology.trim()) {
                        setProfile({
                          ...profile,
                          methodologies: [...(profile.methodologies || []), newMethodology.trim()]
                        });
                        setNewMethodology('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newMethodology.trim()) {
                        setProfile({
                          ...profile,
                          methodologies: [...(profile.methodologies || []), newMethodology.trim()]
                        });
                        setNewMethodology('');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>

                {profile.methodologies && profile.methodologies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.methodologies.map((method, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
                      >
                        {method}
                        <button
                          type="button"
                          onClick={() => setProfile({
                            ...profile,
                            methodologies: profile.methodologies.filter((_, i) => i !== index)
                          })}
                          className="ml-2 text-purple-600 hover:text-purple-800"
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

          {/* Certifications Tab */}
          {activeTab === 'certifications' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certifications & Accreditations
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Add your company's certifications, accreditations, and set-aside qualifications
                </p>

                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newCertification}
                    onChange={(e) => setNewCertification(e.target.value)}
                    placeholder="e.g., ISO 9001:2015, 8(a) Certified, SDVOSB"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newCertification.trim()) {
                        if (!profile.certificationsList.includes(newCertification.trim())) {
                          setProfile({
                            ...profile,
                            certificationsList: [...(profile.certificationsList || []), newCertification.trim()]
                          });
                        }
                        setNewCertification('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCertification.trim() && !profile.certificationsList.includes(newCertification.trim())) {
                        setProfile({
                          ...profile,
                          certificationsList: [...(profile.certificationsList || []), newCertification.trim()]
                        });
                        setNewCertification('');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>

                {/* Common Certifications Quick Add */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Common certifications:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { label: '8(a) Certified Small Business', desc: 'SBA 8(a) Business Development Program' },
                      { label: 'SDVOSB', desc: 'Service-Disabled Veteran-Owned Small Business' },
                      { label: 'HUBZone Certified', desc: 'Historically Underutilized Business Zone' },
                      { label: 'WOSB', desc: 'Women-Owned Small Business' },
                      { label: 'ISO 9001:2015', desc: 'Quality Management System' },
                      { label: 'ISO 27001', desc: 'Information Security Management' },
                      { label: 'CMMI Level 3', desc: 'Capability Maturity Model Integration' },
                      { label: 'FedRAMP Authorized', desc: 'Federal Risk and Authorization Management' },
                      { label: 'SOC 2 Type II', desc: 'Service Organization Control' },
                      { label: 'GSA Schedule Contract', desc: 'General Services Administration Schedule' }
                    ].map((cert) => (
                      <button
                        key={cert.label}
                        type="button"
                        onClick={() => {
                          if (!profile.certificationsList?.includes(cert.label)) {
                            setProfile({
                              ...profile,
                              certificationsList: [...(profile.certificationsList || []), cert.label]
                            });
                          }
                        }}
                        disabled={profile.certificationsList?.includes(cert.label)}
                        className={`text-left p-2 border border-gray-200 rounded hover:bg-gray-50 text-sm ${
                          profile.certificationsList?.includes(cert.label) ? 'bg-green-50 border-green-200' : ''
                        }`}
                      >
                        <div className="font-medium">{cert.label}</div>
                        <div className="text-gray-600 text-xs">{cert.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected Certifications */}
                {profile.certificationsList && profile.certificationsList.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Your Certifications:</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.certificationsList.map((cert, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-amber-100 text-amber-800"
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {cert}
                          <button
                            type="button"
                            onClick={() => setProfile({
                              ...profile,
                              certificationsList: profile.certificationsList.filter((_, i) => i !== index)
                            })}
                            className="ml-2 text-amber-600 hover:text-amber-800"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
