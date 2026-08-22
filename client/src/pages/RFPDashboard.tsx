import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { CompanyProfile, Contract, RFPDashboardStats, RFPResponse, RFPTemplate } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<RFPDashboardStats | null>(null);
  const [recentRFPs, setRecentRFPs] = useState<RFPResponse[]>([]);
  const [opportunities, setOpportunities] = useState<Contract[]>([]);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [templates, setTemplates] = useState<RFPTemplate[]>([]);
  const [selectedContract, setSelectedContract] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<number | ''>('');
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    loadDashboardData();
  }, []);

  // Reload data when component becomes visible (user navigates back)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 [DEBUG] Dashboard: Window focused, reloading data');
      loadDashboardData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsResponse, rfpsResponse, contractsResponse, templatesResponse, profilesResponse] = await Promise.all([
        apiService.getRFPDashboardStats().catch(err => {
          console.warn('Dashboard stats not available:', err.message);
          return { success: false, stats: null };
        }),
        apiService.getRFPResponses(1, 5).catch(err => {
          console.warn('RFP responses not available:', err.message);
          return { success: false, responses: [] };
        }),
        apiService.getContracts(1, 100),
        apiService.getRFPTemplates(),
        apiService.getCompanyProfiles()
      ]);

      if (statsResponse.success && statsResponse.stats) {
        setStats(statsResponse.stats);
      } else {
        // Set default stats if API not available
        setStats({
          totalRFPs: 0,
          activeRFPs: 0,
          submittedRFPs: 0,
          winRate: 0,
          averageScore: 0,
          recentActivity: []
        });
      }

      if (rfpsResponse.success) {
        setRecentRFPs(rfpsResponse.responses || []);
      } else {
        setRecentRFPs([]);
      }

      const loadedContracts = contractsResponse.data || [];
      const loadedProfiles = profilesResponse.profiles || [];
      const loadedTemplates = templatesResponse.templates || [];
      setOpportunities(loadedContracts);
      setProfiles(loadedProfiles);
      setTemplates(loadedTemplates);
      setSelectedContract(current => current || loadedContracts[0]?.noticeId || '');
      setSelectedProfile(current => current && loadedProfiles.some(profile => profile.id === Number(current)) ? current : '');
      setSelectedTemplate(current => current && loadedTemplates.some(template => template.id === Number(current)) ? current : '');
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateApplication = async () => {
    if (!selectedContract) return setError('Select a contract opportunity');
    if (!selectedProfile) return setError('Create and select a company profile before generating an application');
    if (!selectedTemplate) return setError('Select a proposal template before generating an application');

    try {
      setGenerating(true);
      setError(null);
      const response = await apiService.generateRFPResponse({
        contractId: selectedContract,
        templateId: Number(selectedTemplate),
        companyProfileId: Number(selectedProfile),
        customInstructions: 'Create a review-required proposal application draft. Never invent unsupported company claims.'
      });
      if (!response.success) throw new Error(response.message || 'Application generation failed');
      navigate(`/rfp/responses/${response.rfpResponseId}`);
    } catch (err: any) {
      setError(err.message || 'Application generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const selectedContractRecord = opportunities.find(contract => contract.noticeId === selectedContract);
  const selectedProfileRecord = profiles.find(profile => profile.id === Number(selectedProfile));
  const selectedTemplateRecord = templates.find(template => template.id === Number(selectedTemplate));
  const selectedTemplateMaxWords = selectedTemplateRecord?.sections.reduce(
    (total, section) => total + (Number(section.maxWords) || 0),
    0
  ) || 0;
  const verifiedPastPerformanceCount = selectedProfileRecord?.pastPerformance.filter(record => record.status !== 'placeholder').length || 0;
  const verifiedKeyPersonnelCount = selectedProfileRecord?.keyPersonnel.filter(person => person.status !== 'placeholder').length || 0;
  const draftPastPerformanceCount = selectedProfileRecord?.pastPerformance.filter(record => record.status === 'placeholder').length || 0;
  const draftKeyPersonnelCount = selectedProfileRecord?.keyPersonnel.filter(person => person.status === 'placeholder').length || 0;


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
          <h1 className="text-2xl font-bold text-gray-900">RFP Dashboard</h1>
          <p className="text-gray-600">Manage your RFP responses and track performance</p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Link
            to="/rfp/company-profiles"
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            Company Profiles
          </Link>
          <Link
            to="/rfp/templates"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Proposal Templates
          </Link>
          <Link
            to="/rfp/generate"
            className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 transition-colors"
          >
            Generate RFP
          </Link>
        </div>
      </div>

      {error ? (
        <div className="flex items-start justify-between gap-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          <div><strong>Error:</strong> {error}</div>
          <button type="button" onClick={() => setError(null)} className="font-medium underline">Dismiss</button>
        </div>
      ) : null}

      {/* Automatic application generation */}
      <div className="rounded-lg border border-blue-200 bg-white p-6 shadow">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Generate Proposal Application</h2>
          <p className="mt-1 text-sm text-gray-600">
            Select a SAM.gov opportunity, company profile, and proposal template. The generated application is saved as a review-required draft.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Contract opportunity</label>
            <select
              value={selectedContract}
              onChange={event => setSelectedContract(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an opportunity…</option>
              {opportunities.map(contract => (
                <option key={contract.noticeId} value={contract.noticeId}>
                  {contract.title || contract.noticeId} — {contract.agency || 'Agency not listed'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Company profile</label>
            <select
              value={selectedProfile}
              onChange={event => setSelectedProfile(event.target.value ? Number(event.target.value) : '')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                {profiles.length === 0 ? 'No company profiles — create one' : 'Select a company profile…'}
              </option>
              {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Proposal template</label>
            <select
              value={selectedTemplate}
              onChange={event => setSelectedTemplate(event.target.value ? Number(event.target.value) : '')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a proposal template…</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} — {template.agency || 'General'} — {template.sections.length} sections
                </option>
              ))}
            </select>
          </div>
        </div>
        {profiles.length === 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Company facts are required so the application does not invent qualifications.{' '}
            <Link to="/rfp/company-profiles" className="font-medium underline">Create a company profile</Link>.
          </div>
        ) : null}
        {selectedTemplateRecord ? (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <strong>Selected template:</strong> {selectedTemplateRecord.name} · {selectedTemplateRecord.sections.length} sections ·{' '}
            {selectedTemplateMaxWords > 0
              ? `${selectedTemplateMaxWords.toLocaleString()} configured maximum words`
              : 'no section word limits configured'}.{' '}
            <Link to="/rfp/templates" className="font-medium underline">Edit template</Link>
          </div>
        ) : null}
        {selectedContractRecord && (!selectedContractRecord.resourceLinks || selectedContractRecord.resourceLinks.length === 0) ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Solicitation evidence warning:</strong> this SAM.gov record has no downloadable attachments. The draft can use only the opportunity metadata and company profile, so unsupported requirements will remain REVIEW REQUIRED.
          </div>
        ) : null}
        {selectedProfileRecord && (verifiedPastPerformanceCount === 0 || verifiedKeyPersonnelCount === 0) ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Company evidence verification needed:</strong>{' '}
            {verifiedPastPerformanceCount === 0 ? 'no verified past-performance records' : ''}
            {verifiedPastPerformanceCount === 0 && verifiedKeyPersonnelCount === 0 ? ' and ' : ''}
            {verifiedKeyPersonnelCount === 0 ? 'no verified assigned key personnel' : ''} are saved in this profile. The profile currently contains {draftPastPerformanceCount} draft project shell(s) and {draftKeyPersonnelCount} unassigned staffing role(s); these are excluded from factual AI claims until marked Verified.
            {' '}<Link to="/rfp/company-profiles" className="font-medium underline">Complete company profile</Link>
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500">AI-generated content must be reviewed and approved before submission.</p>
          <button
            onClick={handleGenerateApplication}
            disabled={generating || !selectedContract || !selectedProfile || !selectedTemplate}
            className="inline-flex items-center rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <><LoadingSpinner size="sm" className="mr-2" />Generating application…</> : 'Generate Application Draft'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total RFPs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRFPs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active RFPs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeRFPs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-2xl font-bold text-gray-900">{stats.submittedRFPs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.winRate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent RFPs */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Recent RFP Responses</h2>
            <Link
              to="/rfp/responses"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View all →
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentRFPs.length > 0 ? (
            recentRFPs.map((rfp) => (
              <div key={rfp.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Link
                      to={`/rfp/responses/${rfp.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {rfp.title}
                    </Link>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Contract: {rfp.contractId}</span>
                      <span>•</span>
                      <span>Updated: {new Date(rfp.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rfp.status === 'submitted' ? 'bg-green-100 text-green-800' :
                      rfp.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
                      rfp.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {rfp.status.replace('_', ' ')}
                    </span>
                    {rfp.predictedScore && (
                      <span className="text-sm font-medium text-gray-900">
                        Score: {typeof rfp.predictedScore === 'number' ? Math.round(rfp.predictedScore) : Math.round(rfp.predictedScore.overall)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No RFP responses</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by generating your first RFP response.</p>
              <div className="mt-6">
                <Link
                  to="/rfp/generate"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Generate RFP Response
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/rfp/generate"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Generate New RFP</p>
              <p className="text-sm text-gray-500">Create response from contract</p>
            </div>
          </Link>

          <Link
            to="/rfp/company-profiles"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
          >
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Manage Company Profile</p>
              <p className="text-sm text-gray-500">Update capabilities & experience</p>
            </div>
          </Link>

          <Link
            to="/rfp/analytics"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">View Analytics</p>
              <p className="text-sm text-gray-500">Performance insights & trends</p>
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
};

export default RFPDashboard;
