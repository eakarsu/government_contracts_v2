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
  const [editingProfile, setEditingProfile] = useState<CompanyProfile | null>(null);
  const [updating, setUpdating] = useState(false);
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
    businessDetails: {
      legalBusinessName: '', ueiNumber: '', website: '', headquartersAddress: '',
      primaryContact: { name: '', title: '', email: '', phone: '' },
      geographicCoverage: '', contractVehicles: [], socioeconomicDesignations: [],
      insuranceCoverage: '', laborCategories: [], pricingApproach: ''
    },
    pastPerformance: [],
    keyPersonnel: [],
    additionalSections: []
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

  const handleEditProfile = (profile: CompanyProfile) => {
    setEditingProfile(profile);
    setFormData({
      companyName: profile.companyName,
      basicInfo: {
        dunsNumber: profile.basicInfo?.dunsNumber || '',
        cageCode: profile.basicInfo?.cageCode || '',
        certifications: profile.basicInfo?.certifications || [],
        sizeStandard: profile.basicInfo?.sizeStandard || '',
        naicsCode: profile.basicInfo?.naicsCode || []
      },
      capabilities: {
        coreCompetencies: profile.capabilities?.coreCompetencies || [],
        technicalSkills: profile.capabilities?.technicalSkills || [],
        securityClearances: profile.capabilities?.securityClearances || [],
        methodologies: profile.capabilities?.methodologies || []
      },
      businessDetails: {
        legalBusinessName: profile.businessDetails?.legalBusinessName || '',
        ueiNumber: profile.businessDetails?.ueiNumber || '',
        website: profile.businessDetails?.website || '',
        headquartersAddress: profile.businessDetails?.headquartersAddress || '',
        primaryContact: {
          name: profile.businessDetails?.primaryContact?.name || '',
          title: profile.businessDetails?.primaryContact?.title || '',
          email: profile.businessDetails?.primaryContact?.email || '',
          phone: profile.businessDetails?.primaryContact?.phone || ''
        },
        geographicCoverage: profile.businessDetails?.geographicCoverage || '',
        contractVehicles: profile.businessDetails?.contractVehicles || [],
        socioeconomicDesignations: profile.businessDetails?.socioeconomicDesignations || [],
        insuranceCoverage: profile.businessDetails?.insuranceCoverage || '',
        laborCategories: profile.businessDetails?.laborCategories || [],
        pricingApproach: profile.businessDetails?.pricingApproach || ''
      },
      pastPerformance: profile.pastPerformance || [],
      keyPersonnel: profile.keyPersonnel || [],
      additionalSections: profile.additionalSections || []
    });
  };

  const handleUpdateProfile = async () => {
    if (!formData.companyName.trim() || !editingProfile) {
      setError('Company name is required');
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      const response = await apiService.updateCompanyProfile(editingProfile.id, formData);
      if (response.success) {
        setProfiles(profiles.map(p => p.id === editingProfile.id ? response.profile : p));
        setEditingProfile(null);
        resetForm();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingProfile(null);
    resetForm();
    setError(null);
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
      businessDetails: {
        legalBusinessName: '', ueiNumber: '', website: '', headquartersAddress: '',
        primaryContact: { name: '', title: '', email: '', phone: '' },
        geographicCoverage: '', contractVehicles: [], socioeconomicDesignations: [],
        insuranceCoverage: '', laborCategories: [], pricingApproach: ''
      },
      pastPerformance: [],
      keyPersonnel: [],
      additionalSections: []
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

  const addPastPerformance = () => setFormData(prev => ({
    ...prev,
    pastPerformance: [...prev.pastPerformance, {
      status: 'placeholder',
      contractName: '', client: '', agency: '', contractValue: 0, duration: '',
      performanceRating: 'satisfactory', relevanceScore: 0, description: '',
      keyAccomplishments: [], contactInfo: { name: '', title: '', phone: '', email: '' }
    }]
  }));

  const updatePastPerformance = (index: number, updates: Record<string, unknown>) => setFormData(prev => ({
    ...prev,
    pastPerformance: prev.pastPerformance.map((record, itemIndex) => itemIndex === index ? { ...record, ...updates } : record)
  }));

  const addKeyPerson = () => setFormData(prev => ({
    ...prev,
    keyPersonnel: [...prev.keyPersonnel, {
      status: 'placeholder',
      name: '', role: '', clearanceLevel: '', experienceYears: 0,
      education: [], certifications: [], relevantProjects: [], resume: ''
    }]
  }));

  const updateKeyPerson = (index: number, updates: Record<string, unknown>) => setFormData(prev => ({
    ...prev,
    keyPersonnel: prev.keyPersonnel.map((person, itemIndex) => itemIndex === index ? { ...person, ...updates } : person)
  }));

  const addCompanySection = (title = '') => setFormData(prev => ({
    ...prev,
    additionalSections: [...prev.additionalSections, {
      id: `company_section_${Date.now()}_${prev.additionalSections.length}`,
      title,
      content: ''
    }]
  }));

  const addStandardCompanySections = () => {
    const standardTitles = [
      'Company Overview',
      'Services and Solutions',
      'Differentiators',
      'Delivery Approach',
      'Technology Capabilities',
      'Quality Approach',
      'Security and Compliance',
      'Proposal Notes'
    ];
    setFormData(prev => {
      const existing = new Set(prev.additionalSections.map(section => section.title.toLowerCase()));
      const additions = standardTitles
        .filter(title => !existing.has(title.toLowerCase()))
        .map((title, index) => ({ id: `standard_${Date.now()}_${index}`, title, content: '' }));
      return { ...prev, additionalSections: [...prev.additionalSections, ...additions] };
    });
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
                        <span className="font-medium">Legal Name:</span> {profile.businessDetails?.legalBusinessName || 'Review required'}
                      </div>
                      <div>
                        <span className="font-medium">UEI:</span> {profile.businessDetails?.ueiNumber || 'Review required'}
                      </div>
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
                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2">
                      <div>
                        <span className="font-medium">Past Performance:</span>{' '}
                        {profile.pastPerformance?.filter(record => record.status !== 'placeholder').length || 0} verified ·{' '}
                        {profile.pastPerformance?.filter(record => record.status === 'placeholder').length || 0} draft
                      </div>
                      <div>
                        <span className="font-medium">Key Personnel:</span>{' '}
                        {profile.keyPersonnel?.filter(person => person.status !== 'placeholder').length || 0} verified ·{' '}
                        {profile.keyPersonnel?.filter(person => person.status === 'placeholder').length || 0} unassigned role(s)
                      </div>
                    </div>
                    {profile.keyPersonnel && profile.keyPersonnel.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {profile.keyPersonnel.map((person, index) => (
                          <span key={person.id || index} className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            {person.name || 'Unnamed person'}{person.role ? ` — ${person.role}` : ' — role required'}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="ml-4 flex space-x-2">
                    <button 
                      onClick={() => handleEditProfile(profile)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
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

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingProfile) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              {editingProfile ? 'Edit Company Profile' : 'Create Company Profile'}
            </h3>
            
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
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900 mb-1">Business and Proposal Details</h4>
                <p className="mb-4 text-sm text-gray-500">Administrative and commercial information used across proposal sections.</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input value={formData.businessDetails.legalBusinessName} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, legalBusinessName: e.target.value } }))} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Legal business name" />
                  <input value={formData.businessDetails.ueiNumber} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, ueiNumber: e.target.value } }))} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Unique Entity ID (UEI)" />
                  <input value={formData.businessDetails.website} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, website: e.target.value } }))} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Company website" />
                  <input value={formData.businessDetails.geographicCoverage} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, geographicCoverage: e.target.value } }))} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Geographic coverage" />
                  <textarea value={formData.businessDetails.headquartersAddress} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, headquartersAddress: e.target.value } }))} rows={2} className="rounded-md border border-gray-300 px-3 py-2 md:col-span-2" placeholder="Headquarters or business address" />
                  <input value={formData.businessDetails.primaryContact.name} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, primaryContact: { ...prev.businessDetails.primaryContact, name: e.target.value } } }))} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Primary contact name" />
                  <input value={formData.businessDetails.primaryContact.title} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, primaryContact: { ...prev.businessDetails.primaryContact, title: e.target.value } } }))} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Primary contact title" />
                  <input type="email" value={formData.businessDetails.primaryContact.email} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, primaryContact: { ...prev.businessDetails.primaryContact, email: e.target.value } } }))} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Primary contact email" />
                  <input value={formData.businessDetails.primaryContact.phone} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, primaryContact: { ...prev.businessDetails.primaryContact, phone: e.target.value } } }))} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Primary contact phone" />
                  <textarea value={formData.businessDetails.contractVehicles.join('\n')} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, contractVehicles: e.target.value.split('\n') } }))} rows={3} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Contract vehicles — one per line" />
                  <textarea value={formData.businessDetails.socioeconomicDesignations.join('\n')} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, socioeconomicDesignations: e.target.value.split('\n') } }))} rows={3} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Socioeconomic designations — one per line" />
                  <textarea value={formData.businessDetails.laborCategories.join('\n')} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, laborCategories: e.target.value.split('\n') } }))} rows={3} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Labor categories — one per line" />
                  <textarea value={formData.businessDetails.insuranceCoverage} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, insuranceCoverage: e.target.value } }))} rows={3} className="rounded-md border border-gray-300 px-3 py-2" placeholder="Insurance and bonding coverage" />
                  <textarea value={formData.businessDetails.pricingApproach} onChange={e => setFormData(prev => ({ ...prev, businessDetails: { ...prev.businessDetails, pricingApproach: e.target.value } }))} rows={3} className="rounded-md border border-gray-300 px-3 py-2 md:col-span-2" placeholder="Pricing approach, approved rates, and cost assumptions" />
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

              {/* Proposal Evidence */}
              <div className="border-t border-gray-200 pt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">Company Profile Sections</h4>
                    <p className="text-sm text-gray-500">Reusable narrative supplied to proposal generation.</p>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={addStandardCompanySections} className="text-sm font-medium text-green-700 hover:text-green-900">+ Add standard sections</button>
                    <button type="button" onClick={() => addCompanySection()} className="text-sm font-medium text-blue-600 hover:text-blue-800">+ Add custom section</button>
                  </div>
                </div>
                <div className="space-y-3">
                  {formData.additionalSections.map((section, index) => (
                    <div key={section.id || index} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="flex gap-2">
                        <input
                          value={section.title}
                          onChange={e => setFormData(prev => ({ ...prev, additionalSections: prev.additionalSections.map((item, itemIndex) => itemIndex === index ? { ...item, title: e.target.value } : item) }))}
                          className="flex-1 rounded border border-gray-300 px-3 py-2 font-medium"
                          placeholder="Section title"
                        />
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, additionalSections: prev.additionalSections.filter((_, itemIndex) => itemIndex !== index) }))} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                      </div>
                      <textarea
                        value={section.content}
                        onChange={e => setFormData(prev => ({ ...prev, additionalSections: prev.additionalSections.map((item, itemIndex) => itemIndex === index ? { ...item, content: e.target.value } : item) }))}
                        rows={3}
                        className="mt-2 w-full rounded border border-gray-300 px-3 py-2"
                        placeholder="Write verified or clearly identified proposed company information for this section."
                      />
                    </div>
                  ))}
                  {formData.additionalSections.length === 0 ? <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">No narrative sections yet. Add the standard company-profile structure or a custom section.</p> : null}
                </div>
              </div>

              {/* Proposal Evidence */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900">Proposal Evidence</h4>
                <p className="mb-4 text-sm text-gray-500">These verified records populate Past Performance and Key Personnel proposal sections.</p>

                <div className="rounded-md border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h5 className="font-medium text-gray-800">Past Performance</h5>
                    <button type="button" onClick={addPastPerformance} className="text-sm font-medium text-blue-600 hover:text-blue-800">+ Add record</button>
                  </div>
                  <div className="space-y-3">
                    {formData.pastPerformance.map((record, index) => (
                      <div key={index} className="grid grid-cols-1 gap-2 rounded bg-gray-50 p-3 md:grid-cols-2">
                        <input value={record.contractName} onChange={e => updatePastPerformance(index, { contractName: e.target.value })} className="rounded border border-gray-300 px-3 py-2" placeholder="Contract or project name" />
                        <input value={record.client} onChange={e => updatePastPerformance(index, { client: e.target.value })} className="rounded border border-gray-300 px-3 py-2" placeholder="Client or agency" />
                        <select value={record.status || 'verified'} onChange={e => updatePastPerformance(index, { status: e.target.value })} className="rounded border border-gray-300 px-3 py-2">
                          <option value="placeholder">Draft placeholder — excluded from AI claims</option>
                          <option value="verified">Verified evidence — available to AI</option>
                        </select>
                        <textarea value={record.description} onChange={e => updatePastPerformance(index, { description: e.target.value })} rows={2} className="rounded border border-gray-300 px-3 py-2 md:col-span-2" placeholder="Verified scope, results, value, period, and relevance" />
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, pastPerformance: prev.pastPerformance.filter((_, itemIndex) => itemIndex !== index) }))} className="justify-self-start text-sm text-red-600 hover:text-red-800">Remove</button>
                      </div>
                    ))}
                    {formData.pastPerformance.length === 0 ? <p className="text-sm text-amber-700">No past-performance records saved.</p> : null}
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h5 className="font-medium text-gray-800">Key Personnel</h5>
                    <button type="button" onClick={addKeyPerson} className="text-sm font-medium text-blue-600 hover:text-blue-800">+ Add person</button>
                  </div>
                  <div className="space-y-3">
                    {formData.keyPersonnel.map((person, index) => (
                      <div key={index} className="grid grid-cols-1 gap-2 rounded bg-gray-50 p-3 md:grid-cols-2">
                        <input value={person.name} onChange={e => updateKeyPerson(index, { name: e.target.value })} className="rounded border border-gray-300 px-3 py-2" placeholder="Full name" />
                        <input value={person.role} onChange={e => updateKeyPerson(index, { role: e.target.value })} className="rounded border border-gray-300 px-3 py-2" placeholder="Proposed role" />
                        <select value={person.status || 'verified'} onChange={e => updateKeyPerson(index, { status: e.target.value })} className="rounded border border-gray-300 px-3 py-2">
                          <option value="placeholder">Unassigned draft role — excluded from AI claims</option>
                          <option value="verified">Verified assigned person — available to AI</option>
                        </select>
                        <textarea value={person.resume || ''} onChange={e => updateKeyPerson(index, { resume: e.target.value })} rows={2} className="rounded border border-gray-300 px-3 py-2 md:col-span-2" placeholder="Verified experience, qualifications, certifications, and relevant projects" />
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, keyPersonnel: prev.keyPersonnel.filter((_, itemIndex) => itemIndex !== index) }))} className="justify-self-start text-sm text-red-600 hover:text-red-800">Remove</button>
                      </div>
                    ))}
                    {formData.keyPersonnel.length === 0 ? <p className="text-sm text-amber-700">No key personnel saved.</p> : null}
                  </div>
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
                  if (editingProfile) {
                    handleCancelEdit();
                  } else {
                    setShowCreateForm(false);
                    resetForm();
                    setError(null);
                  }
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={creating || updating}
              >
                Cancel
              </button>
              <button
                onClick={editingProfile ? handleUpdateProfile : handleCreateProfile}
                disabled={(creating || updating) || !formData.companyName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {(creating || updating) && <LoadingSpinner size="sm" className="mr-2" />}
                {editingProfile 
                  ? (updating ? 'Updating...' : 'Update Profile')
                  : (creating ? 'Creating...' : 'Create Profile')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfiles;
