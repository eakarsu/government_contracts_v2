import React, { useEffect, useMemo, useRef, useState } from 'react';
import SubmissionPackagePanel from '../components/RFP/SubmissionPackagePanel';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Circle,
  FileSearch,
  FileText,
  Gauge,
  Loader2,
  Save,
  Send,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { apiService } from '../services/api';
import { aiService, type UserContext } from '../services/aiService';
import { contractsApi } from '../services/contractsApi';
import type { CompanyProfile, Contract, RFPAmendment, RFPDashboardStats, RFPProductionWorkspace, RFPResponse, RFPResponseSection, RFPTemplate } from '../types';
import DownloadButtons from '../components/RFP/DownloadButtons';
import LoadingSpinner from '../components/UI/LoadingSpinner';

type BidPrediction = {
  probability: number;
  confidence: number;
  factors: string[];
  recommendations: string[];
};

type BidDecision = {
  prediction: BidPrediction;
  aiAdvisory?: Record<string, any>;
  scoringGovernance?: {
    advisoryOnly: boolean;
    label: string;
    model?: { name: string; version: number; status: string } | null;
  };
};

const selectClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const sectionClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6';

function formatDate(value?: string | null) {
  if (!value) return 'Not provided by SAM.gov';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function placeLabel(place?: Record<string, any> | null) {
  if (!place) return 'Not provided by SAM.gov';
  const value = (item: any) => typeof item === 'object' ? item?.name || item?.code : item;
  return [value(place.city), value(place.state), place.zip || place.zipcode, value(place.country)]
    .filter(Boolean)
    .join(', ') || 'Not provided by SAM.gov';
}

function responseSections(response?: RFPResponse | null) {
  return response?.responseData?.sections || response?.sections || [];
}

const RFPDashboard: React.FC = () => {
  const reviewRef = useRef<HTMLElement | null>(null);
  const [stats, setStats] = useState<RFPDashboardStats | null>(null);
  const [responses, setResponses] = useState<RFPResponse[]>([]);
  const [opportunities, setOpportunities] = useState<Contract[]>([]);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [templates, setTemplates] = useState<RFPTemplate[]>([]);
  const [selectedContract, setSelectedContract] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<number | ''>('');
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('');
  const [evidence, setEvidence] = useState<Contract | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [bidDecision, setBidDecision] = useState<BidDecision | null>(null);
  const [bidLoading, setBidLoading] = useState(false);
  const [activeResponse, setActiveResponse] = useState<RFPResponse | null>(null);
  const [workspace, setWorkspace] = useState<RFPProductionWorkspace | null>(null);
  const [amendments, setAmendments] = useState<RFPAmendment[]>([]);
  const [governanceBusy, setGovernanceBusy] = useState(false);
  const [governanceNotice, setGovernanceNotice] = useState<string | null>(null);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaboratorRole, setCollaboratorRole] = useState<'viewer' | 'author' | 'reviewer' | 'approver'>('reviewer');
  const [approvalEmails, setApprovalEmails] = useState<Record<string, string>>({});
  const [approvalRationales, setApprovalRationales] = useState<Record<string, string>>({});
  const [submission, setSubmission] = useState({ destination: '', submissionMethod: 'SAM.gov', trackingNumber: '' });
  const [outcome, setOutcome] = useState({ outcome: 'NO_BID' as 'WON' | 'LOST' | 'WITHDRAWN' | 'NO_BID', awardValue: '', competitor: '', debrief: '' });
  const [commentBody, setCommentBody] = useState('');
  const [versionComparison, setVersionComparison] = useState<any | null>(null);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [statusSaving, setStatusSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, responsesResponse, contractsResponse, templatesResponse, profilesResponse] = await Promise.all([
        apiService.getRFPDashboardStats(),
        apiService.getRFPResponses(1, 100),
        contractsApi.getContracts(1, 100, { samOnly: true }),
        apiService.getRFPTemplates(),
        apiService.getCompanyProfiles(),
      ]);
      setStats(statsResponse.stats);
      setResponses(responsesResponse.responses || []);
      setOpportunities(contractsResponse.data || []);
      setProfiles(profilesResponse.profiles || []);
      setTemplates(templatesResponse.templates || []);
      setSelectedContract(current => current || contractsResponse.data?.[0]?.noticeId || '');
      setSelectedProfile(current => current && profilesResponse.profiles.some(item => item.id === Number(current)) ? current : '');
      setSelectedTemplate(current => current && templatesResponse.templates.some(item => item.id === Number(current)) ? current : '');
    } catch (loadError: any) {
      setError(loadError.message || 'The RFP workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

  useEffect(() => {
    if (!selectedContract) {
      setEvidence(null);
      return;
    }
    let cancelled = false;
    setEvidenceLoading(true);
    setBidDecision(null);
    contractsApi.getContractEvidence(selectedContract)
      .then(result => { if (!cancelled) setEvidence(result); })
      .catch(loadError => { if (!cancelled) setError(loadError.message || 'Solicitation evidence could not be loaded.'); })
      .finally(() => { if (!cancelled) setEvidenceLoading(false); });
    return () => { cancelled = true; };
  }, [selectedContract]);

  useEffect(() => {
    const response = responses.find(item => item.contractId === selectedContract) || null;
    setActiveResponse(response);
    setSectionDrafts(Object.fromEntries(responseSections(response).map(section => [section.sectionId || section.id, section.content])));
    setSavedSection(null);
    setSectionErrors({});
  }, [selectedContract, responses]);

  const refreshGovernance = async (responseId = activeResponse?.id) => {
    if (!responseId) return;
    const result = await apiService.getRFPProductionWorkspace(responseId);
    setWorkspace(result.workspace);
    setAmendments(result.amendments || []);
  };

  useEffect(() => {
    if (!activeResponse?.id) {
      setWorkspace(null);
      setAmendments([]);
      return;
    }
    refreshGovernance(activeResponse.id).catch(loadError => setError(loadError.message || 'Proposal controls could not be loaded.'));
  }, [activeResponse?.id]);

  const contract = opportunities.find(item => item.noticeId === selectedContract);
  const profile = profiles.find(item => item.id === Number(selectedProfile));
  const template = templates.find(item => item.id === Number(selectedTemplate));
  const sections = responseSections(activeResponse);
  const verifiedPastPerformance = profile?.pastPerformance?.filter(item => item.status !== 'placeholder') || [];
  const verifiedPersonnel = profile?.keyPersonnel?.filter(item => item.status !== 'placeholder') || [];
  const queue = evidence?.documents?.processing_queue || [];
  const documentStats = evidence?.statistics;
  const sam = (evidence?.samData || contract?.samData || {}) as Record<string, any>;
  const resourceLinks = evidence?.resourceLinks || contract?.resourceLinks || [];

  const profileContext = useMemo<UserContext>(() => ({
    companyProfile: profile ? {
      certifications: [...(profile.basicInfo?.certifications || []), ...(profile.businessDetails?.socioeconomicDesignations || [])],
      experienceInNaics: profile.basicInfo?.naicsCode || [],
      agencyRelationships: [...new Set(verifiedPastPerformance.map(item => item.agency).filter(Boolean))],
      pastWins: verifiedPastPerformance.map(item => `${item.contractName}: ${item.description}`),
    } : {},
    preferences: {
      preferredNaicsCodes: contract?.naicsCode ? [contract.naicsCode] : [],
      preferredAgencies: contract?.agency ? [contract.agency] : [],
      preferredStates: [],
      keywords: contract?.title ? contract.title.split(/\W+/).filter(word => word.length > 3) : [],
      minContractValue: 0,
      maxAgeDays: 365,
    },
    opportunityContext: {
      noticeId: contract?.noticeId,
      title: contract?.title,
      agency: contract?.agency,
      naicsCodes: contract?.naicsCode ? [contract.naicsCode] : [],
      classificationCode: contract?.classificationCode,
      setAside: contract?.setAsideCode,
      location: placeLabel(evidence?.placeOfPerformance as Record<string, any>),
      postedDate: contract?.postedDate,
      responseDeadline: evidence?.responseDeadline,
      description: contract?.description,
    },
  }), [contract, evidence, profile, verifiedPastPerformance]);

  const advantages = useMemo(() => {
    if (!profile || !contract) return [];
    const items: string[] = [];
    if (profile.basicInfo?.naicsCode?.includes(contract.naicsCode || '')) items.push(`Company experience includes NAICS ${contract.naicsCode}.`);
    const agencyWins = verifiedPastPerformance.filter(item => contract.agency?.toLowerCase().includes(item.agency?.toLowerCase()));
    if (agencyWins.length) items.push(`${agencyWins.length} verified past-performance record(s) align with the issuing agency.`);
    if (verifiedPastPerformance.length) items.push(`${verifiedPastPerformance.length} verified past-performance record(s) are available for proposal evidence.`);
    if (verifiedPersonnel.length) items.push(`${verifiedPersonnel.length} verified key person(s) can support staffing claims.`);
    if (profile.basicInfo?.certifications?.length) items.push(`${profile.basicInfo.certifications.length} company certification(s) are documented.`);
    return items;
  }, [contract, profile, verifiedPastPerformance, verifiedPersonnel]);

  const weaknesses = useMemo(() => {
    if (!profile || !contract) return [];
    const items: string[] = [];
    if (!profile.basicInfo?.naicsCode?.includes(contract.naicsCode || '')) items.push(`No exact company NAICS match is saved for ${contract.naicsCode || 'this opportunity'}.`);
    if (!verifiedPastPerformance.length) items.push('No verified past-performance record is available.');
    if (!verifiedPersonnel.length) items.push('No verified key personnel are assigned.');
    if (!documentStats?.completed_documents) items.push('No solicitation attachment has completed extraction and indexing.');
    if (!evidence?.responseDeadline) items.push('SAM.gov did not provide a normalized response deadline.');
    return items;
  }, [contract, documentStats, evidence, profile, verifiedPastPerformance, verifiedPersonnel]);

  const evidenceWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!resourceLinks.length) warnings.push('SAM.gov did not provide downloadable solicitation attachments.');
    if (documentStats?.queued_documents) warnings.push(`${documentStats.queued_documents} attachment(s) still await extraction.`);
    if (documentStats?.processing_documents) warnings.push(`${documentStats.processing_documents} attachment(s) are currently processing.`);
    if (documentStats?.failed_documents) warnings.push(`${documentStats.failed_documents} attachment(s) failed processing and require review.`);
    if (resourceLinks.length && !documentStats?.completed_documents) warnings.push('No attachment text is ready for proposal evidence yet.');
    if (!evidence?.responseDeadline) warnings.push('Response deadline is missing from the SAM.gov record.');
    if (!evidence?.placeOfPerformance) warnings.push('Place of performance is missing from the SAM.gov record.');
    return warnings;
  }, [documentStats, evidence, resourceLinks]);

  const runBidDecision = async () => {
    if (!selectedContract || !profile) return setError('Select a company profile before analyzing the bid decision.');
    try {
      setBidLoading(true);
      setError(null);
      const result = await aiService.predictWinProbability(selectedContract, profileContext) as any;
      setBidDecision({ prediction: result.prediction || result, aiAdvisory: result.aiAdvisory, scoringGovernance: result.scoringGovernance });
    } catch (analysisError: any) {
      setError(analysisError.message || 'Bid decision analysis failed.');
    } finally {
      setBidLoading(false);
    }
  };

  const generateDraft = async () => {
    if (!selectedContract || !selectedProfile || !selectedTemplate) return setError('Select an opportunity, company profile, and proposal template.');
    try {
      setGenerating(true);
      setError(null);
      const generated = await apiService.generateRFPResponse({
        contractId: selectedContract,
        templateId: Number(selectedTemplate),
        companyProfileId: Number(selectedProfile),
        customInstructions: 'Use the selected SAM.gov metadata, extracted solicitation evidence, company profile, bid decision context, and template. Never invent unsupported claims. Mark evidence gaps REVIEW REQUIRED.',
        focusAreas: [...(bidDecision?.prediction.factors || []), ...(bidDecision?.prediction.recommendations || [])],
      });
      const loaded = await apiService.getRFPResponse(generated.rfpResponseId);
      setActiveResponse(loaded.response);
      setResponses(current => [loaded.response, ...current.filter(item => item.id !== loaded.response.id)]);
      setSectionDrafts(Object.fromEntries(responseSections(loaded.response).map(section => [section.sectionId || section.id, section.content])));
      await refreshGovernance(loaded.response.id);
      setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (generationError: any) {
      setError(generationError.message || 'Application generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const saveSection = async (section: RFPResponseSection) => {
    if (!activeResponse) return;
    const key = section.sectionId || section.id;
    try {
      setSavingSection(key);
      setSavedSection(null);
      setSectionErrors(current => ({ ...current, [key]: '' }));
      const result = await apiService.updateRFPSection(activeResponse.id, key, { content: sectionDrafts[key] ?? section.content });
      const updateSections = (items: RFPResponseSection[]) => items.map(item => (item.sectionId || item.id) === key ? result.section : item);
      setActiveResponse(current => current ? {
        ...current,
        sections: current.sections ? updateSections(current.sections) : current.sections,
        responseData: current.responseData ? { ...current.responseData, sections: updateSections(current.responseData.sections) } : current.responseData,
        complianceStatus: result.compliance || current.complianceStatus,
      } : current);
      setSectionDrafts(current => ({ ...current, [key]: result.section.content }));
      setSavedSection(key);
      window.setTimeout(() => setSavedSection(current => current === key ? null : current), 3000);
    } catch (saveError: any) {
      setSectionErrors(current => ({ ...current, [key]: saveError.message || 'Section could not be saved.' }));
    } finally {
      setSavingSection(null);
    }
  };

  const updateStatus = async (status: RFPResponse['status']) => {
    if (!activeResponse) return;
    try {
      setStatusSaving(true);
      const result = await apiService.updateRFPResponse(activeResponse.id, { status });
      setActiveResponse(result.response);
      setResponses(current => current.map(item => item.id === result.response.id ? result.response : item));
    } catch (statusError: any) {
      setError(statusError.message || 'Proposal status could not be updated.');
    } finally {
      setStatusSaving(false);
    }
  };

  const runGovernanceAction = async (action: () => Promise<unknown>, successMessage: string) => {
    if (!activeResponse) return;
    try {
      setGovernanceBusy(true);
      setError(null);
      await action();
      await refreshGovernance(activeResponse.id);
      setGovernanceNotice(successMessage);
      window.setTimeout(() => setGovernanceNotice(current => current === successMessage ? null : current), 4000);
    } catch (actionError: any) {
      setError(actionError.response?.data?.error || actionError.message || 'The governed action failed.');
    } finally {
      setGovernanceBusy(false);
    }
  };

  const requirementCoverage = workspace?.requirements?.length
    ? Math.round(workspace.requirements.filter(item => ['COVERED', 'NOT_APPLICABLE'].includes(item.coverageStatus) && item.reviewStatus === 'VERIFIED').length / workspace.requirements.length * 100)
    : 0;

  const probability = bidDecision?.prediction.probability || 0;
  const goNoGo = probability >= 70
    ? { label: 'GO — pursue', color: 'border-emerald-200 bg-emerald-50 text-emerald-800', reason: 'The modeled win probability supports pursuit, subject to human approval.' }
    : probability >= 50
      ? { label: 'CONDITIONAL GO', color: 'border-amber-200 bg-amber-50 text-amber-800', reason: 'Address the documented gaps before committing proposal resources.' }
      : { label: 'NO-GO / REASSESS', color: 'border-red-200 bg-red-50 text-red-800', reason: 'The current evidence does not support an efficient pursuit without mitigation.' };

  const stageDone = [
    Boolean(selectedContract),
    Boolean(selectedProfile && selectedTemplate),
    Boolean(bidDecision),
    Boolean(evidence && !evidenceLoading),
    Boolean(activeResponse),
    Boolean(activeResponse && sections.length),
    Boolean(workspace?.submission),
  ];

  if (loading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-8 text-white shadow-xl sm:px-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200"><Sparkles className="h-4 w-4" /> Unified proposal workspace</div><h1 className="text-3xl font-bold">RFP Capture-to-Submission Dashboard</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">Qualify a real SAM.gov opportunity, verify evidence, generate an application, review every section, and track submission in one governed workflow.</p></div>
          <div className="flex flex-wrap gap-2"><Link to="/rfp/company-profiles" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">Create or edit profiles</Link><Link to="/rfp/templates" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">Create or edit templates</Link></div>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {['Opportunity', 'Profile & template', 'Bid decision', 'Evidence', 'Generate', 'Review', 'Submission'].map((label, index) => <div key={label} className={`rounded-xl border px-3 py-3 text-xs font-semibold ${stageDone[index] ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}><div className="mb-1 flex items-center gap-2">{stageDone[index] ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />} Step {index + 1}</div>{label}</div>)}
      </div>

      {error && <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span><strong>Action required:</strong> {error}</span><button type="button" onClick={() => setError(null)} className="font-semibold underline">Dismiss</button></div>}

      <section className={sectionClass}>
        <div className="mb-4 flex items-center gap-3"><Target className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">1. Select opportunity</h2><p className="text-sm text-slate-500">Only records ingested from SAM.gov are listed.</p></div></div>
        <select data-testid="rfp-opportunity" value={selectedContract} onChange={event => setSelectedContract(event.target.value)} className={selectClass}>
          <option value="">Select a SAM.gov opportunity…</option>
          {opportunities.map(item => <option key={item.noticeId} value={item.noticeId}>{item.title || item.noticeId} — {item.agency || 'Agency not listed'}</option>)}
        </select>
        {contract && <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3"><span><strong>Notice:</strong> {contract.noticeId}</span><span><strong>NAICS:</strong> {contract.naicsCode || 'Not provided'}</span><span><strong>Deadline:</strong> {formatDate(evidence?.responseDeadline)}</span></div>}
      </section>

      <section className={sectionClass}>
        <div className="mb-4 flex items-center gap-3"><Building2 className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">2. Select company profile and proposal template</h2><p className="text-sm text-slate-500">Profiles and templates remain independently creatable and editable.</p></div></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><div className="mb-1 flex items-center justify-between"><label className="text-sm font-medium text-slate-700">Company profile</label><Link to="/rfp/company-profiles" className="text-xs font-semibold text-blue-700 hover:underline">Create or edit</Link></div><select data-testid="rfp-profile" value={selectedProfile} onChange={event => { setSelectedProfile(event.target.value ? Number(event.target.value) : ''); setBidDecision(null); }} className={selectClass}><option value="">Select a company profile…</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.companyName}</option>)}</select></div>
          <div><div className="mb-1 flex items-center justify-between"><label className="text-sm font-medium text-slate-700">Proposal template</label><Link to="/rfp/templates" className="text-xs font-semibold text-blue-700 hover:underline">Create or edit</Link></div><select data-testid="rfp-template" value={selectedTemplate} onChange={event => setSelectedTemplate(event.target.value ? Number(event.target.value) : '')} className={selectClass}><option value="">Select a proposal template…</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name} — {item.sections.length} sections</option>)}</select></div>
        </div>
        {profile && template && <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{verifiedPastPerformance.length}</strong><span className="block text-slate-500">verified past performances</span></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{verifiedPersonnel.length}</strong><span className="block text-slate-500">verified key personnel</span></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{template.sections.length}</strong><span className="block text-slate-500">configured proposal sections</span></div></div>}
      </section>

      <section className={sectionClass}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Gauge className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">3. Bid decision</h2><p className="text-sm text-slate-500">Evidence-backed probability and capture posture for the selected company.</p></div></div><button data-testid="rfp-analyze" type="button" onClick={runBidDecision} disabled={!selectedContract || !selectedProfile || bidLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{bidLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />} Analyze bid decision</button></div>
        {!bidDecision ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Select a company profile and run the bid analysis.</div> : <div className="space-y-4">
          <div className={`rounded-xl border p-3 text-sm font-semibold ${bidDecision.scoringGovernance?.advisoryOnly !== false ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{bidDecision.scoringGovernance?.label || 'Advisory heuristic — not statistically validated. Do not treat this score as a forecast.'}</div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-blue-50 p-4"><div className="text-3xl font-bold text-blue-800">{Math.round(probability)}%</div><div className="text-sm text-blue-700">Win probability</div></div><div className="rounded-xl bg-violet-50 p-4"><div className="text-3xl font-bold text-violet-800">{Math.round(bidDecision.prediction.confidence)}%</div><div className="text-sm text-violet-700">Model confidence</div></div><div className={`rounded-xl border p-4 ${goNoGo.color}`}><div className="font-bold">{goNoGo.label}</div><div className="mt-1 text-xs">{goNoGo.reason}</div></div></div>
          <div className="grid gap-4 lg:grid-cols-3"><div><h3 className="mb-2 text-sm font-semibold text-slate-900">Contributing factors</h3><ul className="space-y-2 text-sm text-slate-600">{bidDecision.prediction.factors.length ? bidDecision.prediction.factors.map(item => <li key={item} className="rounded-lg bg-slate-50 p-2">{item}</li>) : <li>No contributing factors were produced.</li>}</ul></div><div><h3 className="mb-2 text-sm font-semibold text-emerald-800">Competitive advantages</h3><ul className="space-y-2 text-sm text-slate-600">{advantages.length ? advantages.map(item => <li key={item} className="rounded-lg bg-emerald-50 p-2">{item}</li>) : <li>No verified advantage is supported yet.</li>}</ul></div><div><h3 className="mb-2 text-sm font-semibold text-amber-800">Weaknesses and gaps</h3><ul className="space-y-2 text-sm text-slate-600">{weaknesses.length ? weaknesses.map(item => <li key={item} className="rounded-lg bg-amber-50 p-2">{item}</li>) : <li>No material evidence gap identified.</li>}</ul></div></div>
          {bidDecision.prediction.recommendations.length > 0 && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Recommended actions:</strong> {bidDecision.prediction.recommendations.join(' · ')}</div>}
        </div>}
      </section>

      <section className={sectionClass}>
        <div className="mb-4 flex items-center gap-3"><FileSearch className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">4. Solicitation evidence</h2><p className="text-sm text-slate-500">SAM.gov metadata, downloads, text extraction/OCR, and indexing readiness.</p></div></div>
        {evidenceLoading ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading evidence…</div> : evidence ? <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{resourceLinks.length}</strong><span className="block text-slate-500">SAM attachments</span></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{documentStats?.downloaded_files_count || 0}</strong><span className="block text-slate-500">downloaded files</span></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{documentStats?.completed_documents || 0}</strong><span className="block text-slate-500">OCR/extraction completed</span></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{documentStats?.documents_in_vector_db || 0}</strong><span className="block text-slate-500">documents indexed</span></div></div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><span className="text-slate-500">Agency</span><p className="font-medium text-slate-900">{evidence.agency || 'Not provided by SAM.gov'}</p></div><div><span className="text-slate-500">NAICS / classification</span><p className="font-medium text-slate-900">{evidence.naicsCode || 'N/A'} / {evidence.classificationCode || 'N/A'}</p></div><div><span className="text-slate-500">Set-aside</span><p className="font-medium text-slate-900">{evidence.setAsideCode || sam.typeOfSetAsideDescription || 'Not provided'}</p></div><div><span className="text-slate-500">Place of performance</span><p className="font-medium text-slate-900">{placeLabel(evidence.placeOfPerformance as Record<string, any>)}</p></div><div><span className="text-slate-500">Posted</span><p className="font-medium text-slate-900">{formatDate(evidence.postedDate)}</p></div><div><span className="text-slate-500">Response deadline</span><p className="font-medium text-slate-900">{formatDate(evidence.responseDeadline)}</p></div></div>
          {queue.length > 0 && <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Attachment</th><th className="px-3 py-2">Download</th><th className="px-3 py-2">OCR / extraction</th><th className="px-3 py-2">Indexed text</th></tr></thead><tbody className="divide-y divide-slate-100">{queue.map(item => <tr key={item.id}><td className="max-w-md truncate px-3 py-2 font-medium text-slate-800">{item.filename}</td><td className="px-3 py-2">{item.local_file_path ? 'Downloaded' : 'Awaiting download'}</td><td className="px-3 py-2 capitalize">{item.status}</td><td className="px-3 py-2">{item.has_processed_data ? 'Ready' : 'Not ready'}</td></tr>)}</tbody></table></div>}
          {evidenceWarnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" /> Missing-evidence warnings</div><ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">{evidenceWarnings.map(item => <li key={item}>{item}</li>)}</ul></div>}
          {activeResponse && <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Requirements compliance matrix</h3><p className="text-xs text-slate-500">{workspace?.requirements?.length || 0} extracted requirements · {requirementCoverage}% human-verified coverage</p></div><button type="button" disabled={governanceBusy} onClick={() => runGovernanceAction(() => apiService.syncRFPRequirements(activeResponse.id), 'Requirements synchronized from authoritative evidence.')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Synchronize requirements</button></div>
            {!workspace?.requirements?.length ? <p className="text-sm text-slate-500">No explicit “shall,” “must,” or “required” statements were extracted. Synchronize after attachments finish processing.</p> : <div className="max-h-96 overflow-auto"><table className="min-w-full divide-y divide-slate-200 text-xs"><thead className="sticky top-0 bg-white"><tr className="text-left uppercase text-slate-500"><th className="px-2 py-2">Requirement / source</th><th className="px-2 py-2">Proposal section</th><th className="px-2 py-2">Coverage</th><th className="px-2 py-2">Review</th></tr></thead><tbody className="divide-y divide-slate-100">{workspace.requirements.map(requirement => <tr key={requirement.id}><td className="max-w-xl px-2 py-3"><p className="text-slate-800">{requirement.text}</p><p className="mt-1 text-slate-400">{requirement.sourceLocator}</p></td><td className="px-2 py-3"><select value={requirement.mappedSectionId || ''} onChange={event => runGovernanceAction(() => apiService.updateRFPRequirement(activeResponse.id, requirement.id, { mappedSectionId: event.target.value || null }), 'Requirement mapping saved.')} className="rounded border border-slate-300 p-1"><option value="">Unmapped</option>{template?.sections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></td><td className="px-2 py-3"><select value={requirement.coverageStatus} onChange={event => runGovernanceAction(() => apiService.updateRFPRequirement(activeResponse.id, requirement.id, { coverageStatus: event.target.value as any }), 'Requirement coverage saved.')} className="rounded border border-slate-300 p-1">{['UNMAPPED', 'PARTIAL', 'COVERED', 'NOT_APPLICABLE'].map(value => <option key={value}>{value}</option>)}</select></td><td className="px-2 py-3"><select value={requirement.reviewStatus} onChange={event => runGovernanceAction(() => apiService.updateRFPRequirement(activeResponse.id, requirement.id, { reviewStatus: event.target.value as any }), 'Requirement review saved.')} className="rounded border border-slate-300 p-1">{['PENDING', 'VERIFIED', 'REJECTED'].map(value => <option key={value}>{value}</option>)}</select></td></tr>)}</tbody></table></div>}
          </div>}
          {amendments.length > 0 && <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><h3 className="font-semibold text-violet-950">Solicitation amendments detected</h3><div className="mt-2 space-y-2">{amendments.map(amendment => <div key={amendment.id} className="rounded-lg bg-white p-3 text-xs text-slate-700"><div className="flex items-center justify-between gap-2"><strong>{formatDate(amendment.detectedAt)}</strong>{!amendment.acknowledgedAt && <button type="button" onClick={() => runGovernanceAction(() => apiService.acknowledgeRFPAmendment(amendment.id), 'Amendment acknowledged.')} className="font-semibold text-violet-700">Acknowledge</button>}</div><p className="mt-1">Changed: {amendment.changes.map(change => change.field).join(', ')}</p><p>Affected sections: {amendment.affectedSections.join(', ') || 'Review all evidence'}</p></div>)}</div></div>}
        </div> : <p className="text-sm text-slate-500">Select an opportunity to inspect its evidence.</p>}
      </section>

      <section className={sectionClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">5. Generate application draft</h2><p className="text-sm text-slate-500">Uses the selected profile, editable template, SAM metadata, and every completed solicitation extraction.</p></div></div><button data-testid="rfp-generate" type="button" onClick={generateDraft} disabled={generating || !selectedContract || !selectedProfile || !selectedTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><FileText className="h-4 w-4" /> Generate application draft</>}</button></div>
        {!bidDecision && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">You can generate without a bid decision, but analyzing the pursuit first provides stronger capture focus.</p>}
      </section>

      <section ref={reviewRef} className={sectionClass}>
        <div className="mb-4 flex items-center gap-3"><FileText className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">6. Review and edit sections</h2><p className="text-sm text-slate-500">Edit content, check word limits and requirement coverage, then save each section.</p></div></div>
        {!activeResponse ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Generate a draft or select an opportunity with an existing response.</div> : <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><h3 className="font-semibold text-slate-900">{activeResponse.title}</h3><p className="text-sm text-slate-500">Status: {activeResponse.status.replace('_', ' ')} · Updated {formatDate(activeResponse.updatedAt)}</p></div><Link to={`/rfp/responses/${activeResponse.id}/edit`} className="text-sm font-semibold text-blue-700 hover:underline">Open full-screen editor</Link></div>
          {sections.map(section => { const key = section.sectionId || section.id; const content = sectionDrafts[key] ?? section.content; const dirty = content !== section.content; const words = content.trim() ? content.trim().split(/\s+/).length : 0; const max = section.compliance?.wordLimit?.maximum; const mappedRequirements = workspace?.requirements?.filter(item => item.mappedSectionId === key) || []; const coverage = mappedRequirements.length ? Math.round(mappedRequirements.filter(item => ['COVERED', 'NOT_APPLICABLE'].includes(item.coverageStatus) && item.reviewStatus === 'VERIFIED').length / mappedRequirements.length * 100) : section.compliance?.requirementCoverage?.percentage ?? 0; const warnings = [...(section.compliance?.requirementCoverage?.missing || []), ...(mappedRequirements.filter(item => item.reviewStatus !== 'VERIFIED').map(item => `Requirement ${item.requirementKey} still needs human verification.`)), ...(max && words > max ? [`Word limit exceeded by ${words - max} words.`] : [])]; return <article key={key} className={`rounded-xl border p-4 transition ${dirty ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-200'}`}><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="font-semibold text-slate-900">{section.title}</h3><div className="flex flex-wrap gap-2 text-xs">{dirty && <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-800">Unsaved changes</span>}<span className={`rounded-full px-2.5 py-1 font-semibold ${max && words > max ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{words}{max ? ` / ${max}` : ''} words</span><span className={`rounded-full px-2.5 py-1 font-semibold ${coverage >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{coverage}% requirement coverage</span></div></div><textarea rows={10} value={content} onChange={event => { setSectionDrafts(current => ({ ...current, [key]: event.target.value })); setSavedSection(current => current === key ? null : current); setSectionErrors(current => ({ ...current, [key]: '' })); }} className={`${selectClass} resize-y font-mono leading-6`} />{warnings.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Compliance warnings:</strong> {warnings.join(' · ')}</div>}{sectionErrors[key] && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">Save failed: {sectionErrors[key]}</div>}{savedSection === key && <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Section saved. Word-limit compliance was recalculated.</div>}<div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Last saved: {formatDate(section.lastModified)}</span><button type="button" onClick={() => saveSection(section)} disabled={!dirty || savingSection === key} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{savingSection === key ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : savedSection === key ? <><CheckCircle2 className="h-4 w-4" /> Saved</> : dirty ? <><Save className="h-4 w-4" /> Save changes</> : 'No changes'}</button></div></article>; })}
        </div>}
      </section>

      <section className={sectionClass}>
        <div className="mb-4 flex items-center gap-3"><Send className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">7. Save, download, and track submission</h2><p className="text-sm text-slate-500">Move the application through human review and record its submission status.</p></div></div>
        {!activeResponse ? <p className="text-sm text-slate-500">A generated or existing response is required.</p> : <div className="space-y-5">
          {governanceNotice && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" />{governanceNotice}</div>}
          <div><h3 className="mb-2 text-sm font-semibold text-slate-900">Draft lifecycle</h3><div className="grid gap-2 sm:grid-cols-3">{(['draft', 'in_review', 'approved'] as const).map(status => <button key={status} type="button" onClick={() => updateStatus(status)} disabled={statusSaving || activeResponse.status === status || Boolean(workspace?.submission)} className={`rounded-xl border px-3 py-3 text-sm font-semibold capitalize ${activeResponse.status === status ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}>{status.replace('_', ' ')}</button>)}</div><p className="mt-2 text-xs text-slate-500">Submitted status cannot be selected manually; it is set only after all approval gates and checklist items pass.</p></div>
          <div className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{sections.length}</strong><span className="block text-slate-500">proposal sections</span></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{requirementCoverage}%</strong><span className="block text-slate-500">verified requirement coverage</span></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{typeof activeResponse.predictedScore === 'number' ? Math.round(activeResponse.predictedScore) : Math.round(activeResponse.predictedScore?.overall || 0)}</strong><span className="block text-slate-500">predicted proposal score</span></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="capitalize">{workspace?.submission ? 'submitted' : activeResponse.status.replace('_', ' ')}</strong><span className="block text-slate-500">governed state</span></div></div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Collaborators and reviewer assignments</h3><div className="mt-3 flex gap-2"><input type="email" value={collaboratorEmail} onChange={event => setCollaboratorEmail(event.target.value)} placeholder="name@company.com" className={selectClass} /><select value={collaboratorRole} onChange={event => setCollaboratorRole(event.target.value as any)} className={selectClass}>{['viewer', 'author', 'reviewer', 'approver'].map(role => <option key={role}>{role}</option>)}</select><button type="button" disabled={!collaboratorEmail || governanceBusy} onClick={() => runGovernanceAction(async () => { await apiService.addRFPCollaborator(activeResponse.id, collaboratorEmail, collaboratorRole); setCollaboratorEmail(''); }, 'Collaborator assigned.')} className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50">Add</button></div><div className="mt-3 space-y-2">{workspace?.collaborators?.map(item => <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs"><span>{item.email} · <strong>{item.role}</strong></span><button type="button" onClick={() => runGovernanceAction(() => apiService.removeRFPCollaborator(activeResponse.id, item.email), 'Collaborator removed.')} className="font-semibold text-red-700">Remove</button></div>)}{!workspace?.collaborators?.length && <p className="text-xs text-slate-500">No collaborators assigned.</p>}</div></div>
            <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Versions and restore history</h3><button type="button" disabled={governanceBusy} onClick={() => runGovernanceAction(() => apiService.createRFPVersion(activeResponse.id, 'Manual review checkpoint'), 'Version checkpoint created.')} className="text-xs font-semibold text-blue-700">Create version</button></div><div className="mt-3 space-y-2">{workspace?.versions?.slice(0, 5).map(version => <div key={version.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs"><span>v{version.versionNumber} · {version.comment || 'Snapshot'} · {formatDate(version.createdAt)}</span><button type="button" disabled={Boolean(workspace.submission)} onClick={() => runGovernanceAction(async () => { const restored = await apiService.restoreRFPVersion(activeResponse.id, version.id); setActiveResponse(restored.response); }, 'Version restored into a new draft.')} className="font-semibold text-blue-700 disabled:text-slate-400">Restore</button></div>)}{(workspace?.versions?.length || 0) >= 2 && <button type="button" onClick={async () => { const versions = workspace!.versions; const result = await apiService.compareRFPVersions(activeResponse.id, versions[1].id, versions[0].id); setVersionComparison(result.comparison); }} className="text-xs font-semibold text-violet-700">Compare latest two versions</button>}{versionComparison && <div className="rounded-lg bg-violet-50 p-2 text-xs text-violet-900">{versionComparison.sections.filter((item: any) => item.changed).length} changed section(s): {versionComparison.sections.filter((item: any) => item.changed).map((item: any) => item.title).join(', ') || 'none'}</div>}</div></div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Review comments</h3><div className="mt-3 flex gap-2"><input value={commentBody} onChange={event => setCommentBody(event.target.value)} placeholder="Add a proposal-level review comment" className={selectClass} /><button type="button" disabled={!commentBody.trim() || governanceBusy} onClick={() => runGovernanceAction(async () => { await apiService.addRFPComment(activeResponse.id, commentBody); setCommentBody(''); }, 'Review comment added.')} className="rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white disabled:opacity-50">Comment</button></div><div className="mt-3 space-y-2">{workspace?.comments?.map(comment => <div key={comment.id} className={`rounded-lg p-3 text-xs ${comment.resolved ? 'bg-slate-50 text-slate-500' : 'bg-amber-50 text-amber-900'}`}><div className="flex items-center justify-between"><strong>{comment.authorId}</strong>{!comment.resolved && <button type="button" onClick={() => runGovernanceAction(() => apiService.resolveRFPComment(activeResponse.id, comment.id), 'Comment resolved.')} className="font-semibold">Resolve</button>}</div><p className="mt-1">{comment.body}</p></div>)}{!workspace?.comments?.length && <p className="text-xs text-slate-500">No review comments.</p>}</div></div>

          <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Immutable approval gates</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{(['CONTENT', 'COMPLIANCE', 'EXECUTIVE', 'SUBMISSION'] as const).map(gate => { const approval = workspace?.approvals?.find(item => item.gate === gate); return <div key={gate} className="rounded-lg bg-slate-50 p-3 text-xs"><div className="flex items-center justify-between"><strong>{gate}</strong><span className={`rounded-full px-2 py-1 font-semibold ${approval?.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : approval?.decision === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{approval ? `${approval.decision} · cycle ${approval.cycle}` : 'UNASSIGNED'}</span></div>{!approval ? <div className="mt-2 flex gap-2"><input type="email" value={approvalEmails[gate] || ''} onChange={event => setApprovalEmails(current => ({ ...current, [gate]: event.target.value }))} placeholder="reviewer@company.com" className="w-full rounded border border-slate-300 px-2 py-1" /><button type="button" disabled={!approvalEmails[gate]} onClick={() => runGovernanceAction(() => apiService.assignRFPApproval(activeResponse.id, gate, approvalEmails[gate]), `${gate} reviewer assigned.`)} className="font-semibold text-blue-700">Assign</button></div> : <><p className="mt-2">Reviewer: {approval.reviewerEmail}</p>{approval.decision === 'PENDING' && <div className="mt-2 space-y-2"><input value={approvalRationales[gate] || ''} onChange={event => setApprovalRationales(current => ({ ...current, [gate]: event.target.value }))} placeholder="Required decision rationale" className="w-full rounded border border-slate-300 px-2 py-1" /><div className="flex gap-3"><button type="button" onClick={() => runGovernanceAction(() => apiService.decideRFPApproval(activeResponse.id, approval.id, 'APPROVED', approvalRationales[gate] || ''), `${gate} approved.`)} className="font-semibold text-emerald-700">Approve</button><button type="button" onClick={() => runGovernanceAction(() => apiService.decideRFPApproval(activeResponse.id, approval.id, 'REJECTED', approvalRationales[gate] || ''), `${gate} rejected.`)} className="font-semibold text-red-700">Reject</button></div></div>}{approval.rationale && <p className="mt-2 text-slate-500">{approval.rationale}</p>}{approval.decision !== 'PENDING' && <button type="button" onClick={() => runGovernanceAction(() => apiService.assignRFPApproval(activeResponse.id, gate, approvalEmails[gate] || approval.reviewerEmail), `${gate} reapproval cycle started.`)} className="mt-2 font-semibold text-blue-700">Start reapproval cycle</button>}</>}</div>; })}</div></div>

          <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Submission package checklist</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{workspace?.checklistItems?.map(item => <label key={item.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs"><input type="checkbox" checked={item.completed} disabled={governanceBusy || Boolean(workspace.submission)} onChange={event => runGovernanceAction(() => apiService.updateRFPChecklist(activeResponse.id, item.id, event.target.checked), 'Checklist updated.')} /><span>{item.label}{item.completedBy && <small className="block text-slate-500">Completed by {item.completedBy}</small>}</span></label>)}</div></div>

          <SubmissionPackagePanel responseId={activeResponse.id} disabled={governanceBusy || Boolean(workspace?.submission)} />

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="font-semibold text-blue-950">Record submission destination and receipt</h3>{workspace?.submission ? <div className="mt-2 text-sm text-blue-900"><strong>Submitted to {workspace.submission.destination}</strong> via {workspace.submission.submissionMethod}<br />Tracking: {workspace.submission.trackingNumber || 'not provided'} · {formatDate(workspace.submission.submittedAt)}</div> : <div className="mt-3 grid gap-2 md:grid-cols-4"><input value={submission.destination} onChange={event => setSubmission(current => ({ ...current, destination: event.target.value }))} placeholder="Destination URL or office" className={selectClass} /><input value={submission.submissionMethod} onChange={event => setSubmission(current => ({ ...current, submissionMethod: event.target.value }))} placeholder="Submission method" className={selectClass} /><input value={submission.trackingNumber} onChange={event => setSubmission(current => ({ ...current, trackingNumber: event.target.value }))} placeholder="Receipt/tracking number" className={selectClass} /><button type="button" disabled={!submission.destination || !submission.submissionMethod || governanceBusy} onClick={() => runGovernanceAction(() => apiService.recordRFPSubmission(activeResponse.id, submission), 'Submission recorded with immutable approval history.')} className="rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white disabled:opacity-50">Record submission</button></div>}</div>

          <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Outcome and debrief</h3><div className="mt-3 grid gap-2 md:grid-cols-4"><select value={outcome.outcome} onChange={event => setOutcome(current => ({ ...current, outcome: event.target.value as any }))} className={selectClass}>{['WON', 'LOST', 'WITHDRAWN', 'NO_BID'].map(value => <option key={value}>{value}</option>)}</select><input type="number" min="0" value={outcome.awardValue} onChange={event => setOutcome(current => ({ ...current, awardValue: event.target.value }))} placeholder="Award value" className={selectClass} /><input value={outcome.competitor} onChange={event => setOutcome(current => ({ ...current, competitor: event.target.value }))} placeholder="Awardee / competitor" className={selectClass} /><button type="button" disabled={governanceBusy} onClick={() => runGovernanceAction(() => apiService.recordRFPOutcome(activeResponse.id, { ...outcome, awardValue: outcome.awardValue ? Number(outcome.awardValue) : undefined }), 'Outcome and debrief saved for real analytics.')} className="rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Save outcome</button></div><textarea value={outcome.debrief} onChange={event => setOutcome(current => ({ ...current, debrief: event.target.value }))} placeholder="Debrief findings and lessons learned" rows={3} className={`${selectClass} mt-2`} />{workspace?.outcome && <p className="mt-2 text-xs text-slate-500">Current recorded outcome: <strong>{workspace.outcome.outcome}</strong></p>}</div>

          <DownloadButtons mode="rfp" rfpResponseId={activeResponse.id} title={activeResponse.title} />
          {(workspace?.auditEvents?.length || 0) > 0 && <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold text-slate-900">Immutable approval and activity history ({workspace!.auditEvents.length})</summary><div className="mt-3 max-h-64 space-y-2 overflow-auto">{workspace!.auditEvents.slice().reverse().map(event => <div key={event.id} className="rounded-lg bg-slate-50 p-2 text-xs"><strong>#{event.sequence} {event.action}</strong><span className="block text-slate-500">{event.actorId} · {formatDate(event.occurredAt)} · hash {event.hash.slice(0, 12)}…</span></div>)}</div></details>}
        </div>}
      </section>

      <section className={sectionClass}>
        <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-blue-700" /><h2 className="font-semibold text-slate-950">Recent proposal applications</h2></div><Link to="/rfp/responses" className="text-sm font-semibold text-blue-700 hover:underline">View all</Link></div>
        <div className="divide-y divide-slate-100">{responses.slice(0, 5).map(item => <button key={item.id} type="button" onClick={() => setSelectedContract(item.contractId)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50"><div><div className="font-medium text-slate-900">{item.title}</div><div className="text-xs text-slate-500">{item.contractId} · {formatDate(item.updatedAt)}</div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{item.status.replace('_', ' ')}</span></button>)}{responses.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No proposal applications yet.</p>}</div>
      </section>

      {stats && <div className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-white p-4 shadow-sm"><strong className="text-2xl">{stats.totalRFPs}</strong><span className="block text-sm text-slate-500">Total applications</span></div><div className="rounded-xl bg-white p-4 shadow-sm"><strong className="text-2xl">{stats.activeRFPs}</strong><span className="block text-sm text-slate-500">Active</span></div><div className="rounded-xl bg-white p-4 shadow-sm"><strong className="text-2xl">{stats.submittedRFPs}</strong><span className="block text-sm text-slate-500">Submitted</span></div><div className="rounded-xl bg-white p-4 shadow-sm"><strong className="text-2xl">{stats.winRate == null ? 'N/A' : `${stats.winRate}%`}</strong><span className="block text-sm text-slate-500">Actual win rate ({stats.outcomeAnalytics?.won || 0} won / {stats.outcomeAnalytics?.lost || 0} lost)</span></div></div>}
    </div>
  );
};

export default RFPDashboard;
