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
  const [generationProgress, setGenerationProgress] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      console.log('🚀 [DEBUG] Loading RFP Generator data...');
      
      // Load data sequentially to better debug issues
      console.log('🚀 [DEBUG] Loading contracts...');
      const contractsResponse = await apiService.getContracts(1, 100);
      console.log('🚀 [DEBUG] Contracts response:', contractsResponse);

      console.log('🚀 [DEBUG] Loading templates...');
      const templatesResponse = await apiService.getRFPTemplates();
      console.log('🚀 [DEBUG] Templates response:', templatesResponse);

      console.log('🚀 [DEBUG] Loading company profiles...');
      const profilesResponse = await apiService.getCompanyProfiles();
      console.log('🚀 [DEBUG] Company profiles response:', profilesResponse);
      console.log('🚀 [DEBUG] Company profiles response type:', typeof profilesResponse);
      console.log('🚀 [DEBUG] Company profiles response keys:', profilesResponse ? Object.keys(profilesResponse) : 'null');

      // Handle contracts
      if (contractsResponse && contractsResponse.success) {
        const contractsData = contractsResponse.data || [];
        setContracts(contractsData);
        setSelectedContract(current => current || contractsData[0]?.noticeId || '');
        console.log('✅ [DEBUG] Loaded contracts:', contractsData.length);
      } else {
        console.error('❌ [DEBUG] Contracts failed:', contractsResponse);
        setContracts([]);
      }

      // Handle templates
      if (templatesResponse && templatesResponse.success) {
        const templatesData = templatesResponse.templates || [];
        setTemplates(templatesData);
        setSelectedTemplate(current => current && templatesData.some(template => template.id === Number(current)) ? current : '');
        console.log('✅ [DEBUG] Loaded templates:', templatesData.length);
      } else {
        console.error('❌ [DEBUG] Templates failed:', templatesResponse);
        setTemplates([]);
      }

      // Handle company profiles
      if (profilesResponse) {
        console.log('🚀 [DEBUG] Checking profiles response structure...');
        
        let profilesData: CompanyProfile[] = [];
        
        if (profilesResponse.success && profilesResponse.profiles) {
          profilesData = profilesResponse.profiles;
          console.log('✅ [DEBUG] Found profiles in success.profiles:', profilesData.length);
        } else if (Array.isArray(profilesResponse)) {
          profilesData = profilesResponse;
          console.log('✅ [DEBUG] Found profiles as direct array:', profilesData.length);
        } else {
          // Try to access other possible properties using type assertion for debugging
          const responseAny = profilesResponse as any;
          if (responseAny.data) {
            profilesData = responseAny.data;
            console.log('✅ [DEBUG] Found profiles in data:', profilesData.length);
          } else if (responseAny.companyProfiles) {
            profilesData = responseAny.companyProfiles;
            console.log('✅ [DEBUG] Found profiles in companyProfiles:', profilesData.length);
          } else {
            console.error('❌ [DEBUG] No profiles found in any expected structure');
            console.error('❌ [DEBUG] Available keys:', Object.keys(profilesResponse));
          }
        }
        
        setProfiles(profilesData);
        setSelectedProfile(current => current && profilesData.some(profile => profile.id === Number(current)) ? current : '');
        console.log('✅ [DEBUG] Final profiles set:', profilesData.length);
      } else {
        console.error('❌ [DEBUG] Profiles response is null/undefined:', profilesResponse);
        setProfiles([]);
      }
    } catch (err: any) {
      console.error('❌ [DEBUG] LoadData error:', err);
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
      setGenerationProgress('Validating inputs...');

      // Get the selected template to check if it has sections
      const selectedTemplateObj = templates.find(t => t.id === Number(selectedTemplate));
      if (!selectedTemplateObj || !selectedTemplateObj.sections || selectedTemplateObj.sections.length === 0) {
        setError('Selected template has no sections defined. Please choose a different template or add sections to this template.');
        return;
      }

      // Get the selected company profile to check if it has data
      const selectedProfileObj = profiles.find(p => p.id === Number(selectedProfile));
      if (!selectedProfileObj) {
        setError('Selected company profile not found. Please choose a different profile.');
        return;
      }

      setGenerationProgress('Preparing generation request...');

      console.log('🚀 [DEBUG] Generating RFP with:', {
        contract: selectedContract,
        template: selectedTemplateObj.name,
        templateSections: selectedTemplateObj.sections.length,
        profile: selectedProfileObj.companyName,
        customInstructions,
        focusAreas
      });

      // Log detailed template sections for debugging
      console.log('🚀 [DEBUG] Template sections:', selectedTemplateObj.sections.map(s => ({
        title: s.title,
        description: s.description,
        required: s.required,
        mappings: s.mappings
      })));

      // Log company profile capabilities for debugging
      console.log('🚀 [DEBUG] Company profile capabilities:', {
        coreCompetencies: selectedProfileObj.capabilities?.coreCompetencies || [],
        technicalSkills: selectedProfileObj.capabilities?.technicalSkills || [],
        methodologies: selectedProfileObj.capabilities?.methodologies || []
      });

      const request: RFPGenerationRequest = {
        contractId: selectedContract,
        templateId: Number(selectedTemplate),
        companyProfileId: Number(selectedProfile),
        customInstructions: customInstructions || undefined,
        focusAreas: focusAreas.length > 0 ? focusAreas : undefined
      };

      console.log('🚀 [DEBUG] Full RFP generation request:', request);

      setGenerationProgress('Sending request to server...');

      // Start a timeout to show progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev.includes('Sending request')) return 'Processing contract data...';
          if (prev.includes('Processing contract')) return 'Generating content sections...';
          if (prev.includes('Generating content')) return 'Finalizing RFP response...';
          return 'Still processing... (this may take a while)';
        });
      }, 10000); // Update every 10 seconds

      try {
        const response = await apiService.generateRFPResponse(request);
        clearInterval(progressInterval);

        console.log('🚀 [DEBUG] RFP Generation response:', response);

        if (response.success) {
          console.log('✅ [DEBUG] RFP generated successfully with ID:', response.rfpResponseId);
          console.log('✅ [DEBUG] Generation details:', {
            sectionsGenerated: response.sectionsGenerated,
            complianceScore: response.complianceScore,
            predictedScore: response.predictedScore,
            generationTime: response.generationTime
          });
          
          setGenerationProgress('Generation complete! Redirecting...');
          
          // Navigate to the generated RFP response to see the result
          navigate(`/rfp/responses/${response.rfpResponseId}`);
        } else {
          console.error('❌ [DEBUG] RFP generation failed:', response.message);
          setError(response.message || 'Failed to generate RFP response');
        }
      } catch (apiError) {
        clearInterval(progressInterval);
        throw apiError;
      }
    } catch (err: any) {
      console.error('❌ [DEBUG] RFP Generation error:', err);
      setError(err.message || 'An error occurred during RFP generation');
    } finally {
      setGenerating(false);
      setGenerationProgress('');
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

  const selectedContractRecord = contracts.find(contract => contract.noticeId === selectedContract);
  const selectedTemplateRecord = templates.find(template => template.id === Number(selectedTemplate));
  const selectedProfileRecord = profiles.find(profile => profile.id === Number(selectedProfile));
  const selectedTemplateMaxWords = selectedTemplateRecord?.sections.reduce(
    (total, section) => total + (Number(section.maxWords) || 0),
    0
  ) || 0;

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

      {generating && generationProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center">
            <LoadingSpinner size="sm" className="mr-3" />
            <div>
              <div className="text-blue-800 font-medium">Generating RFP Response</div>
              <div className="text-blue-600 text-sm">{generationProgress}</div>
              <div className="text-blue-500 text-xs mt-1">
                This process typically takes 30-60 seconds. If it takes longer, the server may be experiencing issues.
              </div>
            </div>
          </div>
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
            {selectedContractRecord && (!selectedContractRecord.resourceLinks || selectedContractRecord.resourceLinks.length === 0) ? (
              <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <strong>Solicitation evidence warning:</strong> this SAM.gov record has no downloadable attachments. Unsupported requirements will remain REVIEW REQUIRED.
              </p>
            ) : null}
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
            {templates.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">
                No templates available. <button 
                  onClick={() => navigate('/rfp/templates')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Create one first
                </button>.
              </p>
            ) : (
              selectedTemplate && (
                <div className="mt-2 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Selected Template:</strong> {templates.find(t => t.id === Number(selectedTemplate))?.name}
                  </p>
                  <p className="text-sm text-blue-600">
                    Sections: {templates.find(t => t.id === Number(selectedTemplate))?.sections?.length || 0}
                  </p>
                  <p className="text-sm text-blue-600">
                    Configured maximum: {selectedTemplateMaxWords > 0 ? `${selectedTemplateMaxWords.toLocaleString()} words` : 'No section word limits'}
                  </p>
                  {templates.find(t => t.id === Number(selectedTemplate))?.sections?.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      ⚠️ This template has no sections defined. Please add sections to generate a complete RFP.
                    </p>
                  )}
                </div>
              )
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
            {profiles.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">
                No company profiles available. <button 
                  onClick={() => navigate('/rfp/company-profiles')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Create one first
                </button>.
              </p>
            ) : (
              selectedProfile && (
                <div className="mt-2 p-3 bg-green-50 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>Selected Profile:</strong> {profiles.find(p => p.id === Number(selectedProfile))?.companyName}
                  </p>
                  <p className="text-sm text-green-600">
                    Core Competencies: {profiles.find(p => p.id === Number(selectedProfile))?.capabilities?.coreCompetencies?.length || 0}
                  </p>
                  <p className="text-sm text-green-600">
                    Technical Skills: {profiles.find(p => p.id === Number(selectedProfile))?.capabilities?.technicalSkills?.length || 0}
                  </p>
                  <p className="text-sm text-green-600">
                    Past Performance: {selectedProfileRecord?.pastPerformance.length || 0} · Key Personnel: {selectedProfileRecord?.keyPersonnel.length || 0}
                  </p>
                  {selectedProfileRecord && (
                    selectedProfileRecord.pastPerformance.filter(record => record.status !== 'placeholder').length === 0
                    || selectedProfileRecord.keyPersonnel.filter(person => person.status !== 'placeholder').length === 0
                  ) ? (
                    <p className="mt-2 text-sm text-amber-800">
                      Draft project shells and unassigned roles are excluded from factual AI claims. Enter real evidence and mark each record Verified to use it.
                    </p>
                  ) : null}
                </div>
              )
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
              {generating ? (generationProgress || 'Generating...') : 'Generate RFP Response'}
            </button>
          </div>

          {/* Download Options Info */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">📄 Download Options</h3>
            <p className="text-sm text-blue-600">
              After generating your RFP response, you'll be able to download it in multiple formats:
            </p>
            <ul className="text-sm text-blue-600 mt-2 ml-4 list-disc">
              <li><strong>Text (.txt)</strong> - Plain text format for easy editing</li>
              <li><strong>PDF (.pdf)</strong> - Professional formatted document for submission</li>
              <li><strong>Word (.docx)</strong> - Microsoft Word format for further editing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RFPGenerator;
