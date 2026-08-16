import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Bot, CalendarClock, CheckCircle2, ChevronRight, FileCheck2, FileText, Filter, FolderKanban, Plus, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { lifecycleApi, LifecycleRecord } from '../services/lifecycleApi';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { formatLifecycleValue, statusTone, titleCase } from '../utils/lifecyclePresentation';
import ProfessionalAiReport from '../components/AI/ProfessionalAiReport';

const resourceIcons: Record<string, React.ElementType> = {
  matters: FolderKanban, parties: Users, 'document-versions': FileText, clauses: FileCheck2, obligations: CheckCircle2,
  milestones: CalendarClock, amendments: FileText, approvals: ShieldCheck, renewals: CalendarClock,
  'risk-assessments': AlertTriangle, templates: FileCheck2, 'ai-reviews': Bot, integrations: ArrowRight,
};

const preferredFields: Record<string, string[]> = {
  matters: ['matterNumber', 'title', 'agency', 'stage', 'status', 'ownerId', 'retentionUntil'],
  parties: ['name', 'partyType', 'contractRole', 'uei', 'cageCode', 'riskRating', 'sanctionsStatus'],
  'document-versions': ['title', 'documentType', 'version', 'privilege', 'effectiveDate', 'uploadedBy', 'contentHash'],
  clauses: ['clauseKey', 'title', 'category', 'citation', 'riskLevel', 'status', 'aiConfidence'],
  obligations: ['reference', 'description', 'ownerId', 'dueDate', 'recurrence', 'status', 'escalationLevel'],
  milestones: ['reference', 'name', 'dueDate', 'ownerId', 'status', 'evidenceUrl'],
  amendments: ['amendmentNumber', 'title', 'effectiveDate', 'priceDelta', 'riskLevel', 'status', 'impactSummary'],
  approvals: ['step', 'resourceType', 'decision', 'actorId', 'rationale', 'createdAt'],
  renewals: ['optionPeriod', 'noticeDeadline', 'exerciseDeadline', 'estimatedValue', 'status', 'ownerId', 'recommendation'],
  'risk-assessments': ['assessmentKey', 'overallRating', 'legalScore', 'financialScore', 'operationalScore', 'cybersecurityScore', 'complianceScore', 'assessedBy'],
  templates: ['templateKey', 'version', 'name', 'agency', 'contractType', 'status', 'approvedBy', 'effectiveFrom'],
  'ai-reviews': ['reviewType', 'model', 'confidence', 'status', 'advisoryOnly', 'createdBy', 'createdAt'],
  integrations: ['provider', 'operation', 'status', 'attempts', 'nextAttemptAt', 'lastErrorCode', 'createdAt'],
};

const stages = ['INTAKE', 'DILIGENCE', 'NEGOTIATION', 'APPROVAL', 'EXECUTION', 'PERFORMANCE', 'RENEWAL', 'CLOSEOUT'];

function valueView(field: string, value: any) {
  if (value === null || value === undefined || value === '') return <span className="text-gray-400">—</span>;
  if (typeof value === 'boolean') return <span className={value ? 'badge-success' : 'badge-warning'}>{value ? 'Yes' : 'No'}</span>;
  if (/status|stage|risk|decision|privilege|partyType|contractRole/i.test(field)) {
    return <span className={statusTone(value)}>{titleCase(String(value))}</span>;
  }
  const text = formatLifecycleValue(field, value);
  return <span title={text}>{text.length > 72 ? `${text.slice(0, 69)}…` : text}</span>;
}

const NewMatterModal: React.FC<{ onClose: () => void; onCreate: (value: any) => void; pending: boolean }> = ({ onClose, onCreate, pending }) => {
  const [form, setForm] = useState({ matterNumber: '', title: '', agency: '', contractType: 'Firm-Fixed-Price', jurisdiction: 'US-FEDERAL', ownerId: '' });
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/60 p-4" role="dialog" aria-modal="true">
    <form className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onSubmit={event => { event.preventDefault(); onCreate(form); }}>
      <div className="flex items-center justify-between border-b px-6 py-5"><div><h2 className="text-xl font-semibold">Open contract matter</h2><p className="text-sm text-gray-500">Create a governed lifecycle record linked to accountable ownership.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-4 p-6 md:grid-cols-2">
        {[
          ['matterNumber', 'Matter number', 'GOV-CLM-2026-017'], ['title', 'Matter title', 'Agency cloud services task order'],
          ['agency', 'Agency', 'General Services Administration'], ['ownerId', 'Accountable owner', 'contract-manager-1'],
        ].map(([key, label, placeholder]) => <label key={key} className="block"><span className="label">{label}</span><input className="input" required value={(form as any)[key]} placeholder={placeholder} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} /></label>)}
        <label className="block"><span className="label">Contract type</span><select className="input" value={form.contractType} onChange={e => setForm(current => ({ ...current, contractType: e.target.value }))}><option>Firm-Fixed-Price</option><option>Cost-Plus-Fixed-Fee</option><option>IDIQ</option><option>Time-and-Materials</option></select></label>
        <label className="block"><span className="label">Jurisdiction</span><input className="input" required value={form.jurisdiction} onChange={e => setForm(current => ({ ...current, jurisdiction: e.target.value }))} /></label>
      </div>
      <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={pending}>{pending ? 'Creating…' : 'Create matter'}</button></div>
    </form>
  </div>;
};

const ApprovalModal: React.FC<{ matters: LifecycleRecord[]; onClose: () => void; onCreate: (matterId: string, value: any) => void; pending: boolean }> = ({ matters, onClose, onCreate, pending }) => {
  const [matterId, setMatterId] = useState(matters[0]?.id || '');
  const [form, setForm] = useState({ step: 'LEGAL', decision: 'APPROVED', rationale: '' });
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/60 p-4" role="dialog" aria-modal="true"><form className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onSubmit={event => { event.preventDefault(); onCreate(matterId, form); }}>
    <div className="flex items-center justify-between border-b px-6 py-5"><div><h2 className="text-xl font-semibold">Record independent approval</h2><p className="text-sm text-gray-500">Approval evidence is append-only and subject to segregation of duties.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <div className="space-y-4 p-6"><label className="block"><span className="label">Contract matter</span><select className="input" value={matterId} onChange={event => setMatterId(event.target.value)}>{matters.map(matter => <option key={matter.id} value={matter.id}>{matter.matterNumber} · {matter.title}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Approval step</span><select className="input" value={form.step} onChange={event => setForm(current => ({ ...current, step: event.target.value }))}><option>LEGAL</option><option>BUSINESS</option><option>COMPLIANCE</option><option>SECURITY</option></select></label><label><span className="label">Decision</span><select className="input" value={form.decision} onChange={event => setForm(current => ({ ...current, decision: event.target.value }))}><option>APPROVED</option><option>REJECTED</option></select></label></div><label className="block"><span className="label">Decision rationale</span><textarea required minLength={20} className="input min-h-28" placeholder="Document the evidence reviewed, exceptions considered, and basis for the decision." value={form.rationale} onChange={event => setForm(current => ({ ...current, rationale: event.target.value }))} /></label></div>
    <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={pending || !matterId}>{pending ? 'Recording…' : 'Record approval'}</button></div>
  </form></div>;
};

const AiReviewPanel: React.FC<{ matters: LifecycleRecord[] }> = ({ matters }) => {
  const [matterId, setMatterId] = useState('');
  const [question, setQuestion] = useState('Assess lifecycle readiness, unresolved risks, missing evidence, and approvals required before the next stage.');
  const [result, setResult] = useState<LifecycleRecord | null>(null);
  const mutation = useMutation({ mutationFn: () => lifecycleApi.aiReview(matterId || matters[0]?.id, question), onSuccess: record => setResult(record) });
  if (!matters.length) return null;
  return <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 text-white shadow-lg">
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.3fr]">
      <div><div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-blue-200"><Sparkles className="h-4 w-4" /> Governed AI review</div><h2 className="text-2xl font-bold">Ask AI about a contract matter</h2><p className="mt-2 text-sm leading-6 text-blue-100">Analysis is evidence-grounded, stored as advisory-only, and cannot approve, submit, sign, or commit either party.</p>
        <select className="mt-5 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm" value={matterId || matters[0].id} onChange={e => setMatterId(e.target.value)}>{matters.map(matter => <option className="text-gray-900" key={matter.id} value={matter.id}>{matter.matterNumber} · {matter.title}</option>)}</select>
        <textarea className="mt-3 min-h-28 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm placeholder:text-blue-200" value={question} onChange={e => setQuestion(e.target.value)} />
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !question.trim()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-900 hover:bg-blue-50 disabled:opacity-60"><Bot className="h-4 w-4" />{mutation.isPending ? 'Reviewing evidence…' : 'Run AI review'}</button>
      </div>
      <div>{result ? <ProfessionalAiReport value={result.output} title="Lifecycle Readiness Report" subtitle="Evidence, risks, approvals, and next-stage readiness" model={result.model} status={result.status} dark /> : <div className="flex min-h-64 items-center justify-center rounded-xl border border-white/15 bg-white/10 p-5 text-center text-sm text-blue-200">Select a matter and run the review to receive a structured professional assessment.</div>}</div>
    </div>
  </section>;
};

const LifecycleWorkspace: React.FC = () => {
  const { resource } = useParams();
  const currentResource = resource || '';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LifecycleRecord | null>(null);
  const [showNewMatter, setShowNewMatter] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [transitionRationale, setTransitionRationale] = useState('');
  const catalog = useQuery({ queryKey: ['lifecycle-catalog'], queryFn: lifecycleApi.catalog });
  const overview = useQuery({ queryKey: ['lifecycle-overview'], queryFn: lifecycleApi.overview });
  const records = useQuery({ queryKey: ['lifecycle-records', currentResource, search], queryFn: () => lifecycleApi.records(currentResource, search), enabled: Boolean(currentResource) });
  const matters = useQuery({ queryKey: ['lifecycle-records', 'matters', ''], queryFn: () => lifecycleApi.records('matters') });
  const createMatter = useMutation({ mutationFn: lifecycleApi.createMatter, onSuccess: () => { toast.success('Contract matter created'); setShowNewMatter(false); queryClient.invalidateQueries({ queryKey: ['lifecycle-overview'] }); queryClient.invalidateQueries({ queryKey: ['lifecycle-records'] }); } });
  const createApproval = useMutation({ mutationFn: ({ matterId, value }: any) => lifecycleApi.createApproval(matterId, value), onSuccess: () => { toast.success('Independent approval recorded'); setShowApproval(false); queryClient.invalidateQueries({ queryKey: ['lifecycle-overview'] }); queryClient.invalidateQueries({ queryKey: ['lifecycle-records'] }); } });
  const transition = useMutation({ mutationFn: ({ id, nextStage, rationale }: any) => lifecycleApi.transitionMatter(id, nextStage, rationale), onSuccess: record => { toast.success(`Matter advanced to ${titleCase(record.stage)}`); setSelected(record); setTransitionRationale(''); queryClient.invalidateQueries({ queryKey: ['lifecycle-overview'] }); queryClient.invalidateQueries({ queryKey: ['lifecycle-records'] }); } });
  const resourceMeta = catalog.data?.find(item => item.key === currentResource);
  const fields = useMemo(() => preferredFields[currentResource] || [], [currentResource]);

  if (catalog.isLoading || overview.isLoading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>;

  if (!currentResource) {
    const metrics = overview.data?.metrics || {};
    return <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="text-sm font-semibold uppercase tracking-widest text-primary-600">Unified government contracting</div><h1 className="mt-1 text-3xl font-bold text-gray-950">Contract Lifecycle Command Center</h1><p className="mt-2 max-w-3xl text-gray-600">Manage opportunity intake through closeout with immutable evidence, FAR/DFARS governance, independent approvals, and human-controlled AI.</p></div><button className="btn-primary gap-2" onClick={() => setShowNewMatter(true)}><Plus className="h-4 w-4" /> Open matter</button></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[
        ['Active matters', metrics.activeMatters, FolderKanban, 'text-blue-700 bg-blue-50'], ['High-risk clauses', metrics.highRiskClauses, AlertTriangle, 'text-red-700 bg-red-50'], ['Overdue obligations', metrics.overdueObligations, CalendarClock, 'text-amber-700 bg-amber-50'], ['Pending approvals', metrics.pendingApprovals, ShieldCheck, 'text-violet-700 bg-violet-50'], ['Upcoming options', metrics.upcomingRenewals, CheckCircle2, 'text-emerald-700 bg-emerald-50'],
      ].map(([label, value, Icon, tone]: any) => <article key={label} className="card"><div className={`inline-flex rounded-xl p-2 ${tone}`}><Icon className="h-5 w-5" /></div><div className="mt-4 text-3xl font-bold">{value ?? 0}</div><div className="mt-1 text-sm text-gray-500">{label}</div></article>)}</div>
      <AiReviewPanel matters={matters.data || []} />
      <section><div className="mb-4"><h2 className="text-xl font-semibold">Lifecycle workspaces</h2><p className="text-sm text-gray-500">Every workspace uses the same governed matter, evidence, approval, and audit foundation.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{catalog.data?.map(item => { const Icon = resourceIcons[item.key] || FileText; return <Link key={item.key} to={`/lifecycle/${item.key}`} className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"><div className="flex items-start justify-between"><div className="rounded-lg bg-primary-50 p-2 text-primary-700"><Icon className="h-5 w-5" /></div><span className="text-2xl font-bold text-gray-900">{overview.data?.counts?.[item.key] ?? 0}</span></div><h3 className="mt-4 font-semibold text-gray-950">{item.label}</h3><p className="mt-1 text-sm leading-5 text-gray-500">{item.description}</p><div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary-700">Open workspace <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></div></Link>; })}</div></section>
      {showNewMatter && <NewMatterModal pending={createMatter.isPending} onClose={() => setShowNewMatter(false)} onCreate={value => createMatter.mutate(value)} />}
    </div>;
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><Link to="/lifecycle" className="text-sm font-medium text-primary-700">← Lifecycle command center</Link><h1 className="mt-2 text-3xl font-bold">{resourceMeta?.label || titleCase(currentResource)}</h1><p className="mt-2 text-gray-600">{resourceMeta?.description}</p></div><div className="flex flex-wrap gap-2"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input w-64 pl-9" placeholder="Search records" value={search} onChange={e => setSearch(e.target.value)} /></div><button className="btn-secondary px-3" title="Filters"><Filter className="h-4 w-4" /></button>{currentResource === 'matters' && <button className="btn-primary gap-2" onClick={() => setShowNewMatter(true)}><Plus className="h-4 w-4" /> Add</button>}{currentResource === 'approvals' && <button className="btn-primary gap-2" onClick={() => setShowApproval(true)}><ShieldCheck className="h-4 w-4" /> Record approval</button>}</div></div>
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><div className="font-semibold">{records.data?.length || 0} governed records</div>{resourceMeta?.appendOnly && <span className="badge-info">Append-only evidence</span>}</div>
      {records.isLoading ? <div className="flex h-56 items-center justify-center"><LoadingSpinner /></div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{fields.map(field => <th key={field} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{titleCase(field)}</th>)}<th className="px-4 py-3"><span className="sr-only">Details</span></th></tr></thead><tbody className="divide-y divide-gray-100">{records.data?.map(row => <tr key={row.id} className="hover:bg-gray-50">{fields.map(field => <td key={field} className="max-w-xs whitespace-nowrap px-4 py-3 text-sm text-gray-700">{valueView(field, row[field])}</td>)}<td className="px-4 py-3 text-right"><button className="text-sm font-semibold text-primary-700" onClick={() => setSelected(row)}>Review</button></td></tr>)}</tbody></table></div>}
    </div>
    {selected && <div className="fixed inset-0 z-[70] flex justify-end bg-gray-950/40" onClick={() => setSelected(null)}><aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={event => event.stopPropagation()}><div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-5"><div><div className="text-xs font-semibold uppercase tracking-widest text-primary-600">Governed record</div><h2 className="mt-1 text-xl font-bold">{resourceMeta?.label}</h2></div><button className="rounded-lg p-2 hover:bg-gray-100" onClick={() => setSelected(null)}><X className="h-5 w-5" /></button></div><dl className="grid gap-5 p-6 sm:grid-cols-2">{Object.entries(selected).filter(([key]) => !['id', 'matterId'].includes(key)).map(([key, value]) => <div key={key} className={typeof value === 'string' && value.length > 100 ? 'sm:col-span-2' : ''}><dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{titleCase(key)}</dt><dd className="mt-1 break-words text-sm leading-6 text-gray-800">{valueView(key, value)}</dd></div>)}</dl>{currentResource === 'matters' && stages.indexOf(selected.stage) < stages.length - 1 && <div className="border-t bg-gray-50 p-6"><div className="text-sm font-semibold">Advance lifecycle stage</div><p className="mt-1 text-xs text-gray-500">Next controlled stage: {titleCase(stages[stages.indexOf(selected.stage) + 1])}</p><textarea className="input mt-3 min-h-24" placeholder="Explain the evidence and review supporting this transition." value={transitionRationale} onChange={event => setTransitionRationale(event.target.value)} /><button type="button" disabled={transition.isPending || transitionRationale.trim().length < 20} onClick={() => transition.mutate({ id: selected.id, nextStage: stages[stages.indexOf(selected.stage) + 1], rationale: transitionRationale })} className="btn-primary mt-3 gap-2">{transition.isPending ? 'Advancing…' : 'Advance stage'}<ArrowRight className="h-4 w-4" /></button></div>}</aside></div>}
    {showNewMatter && <NewMatterModal pending={createMatter.isPending} onClose={() => setShowNewMatter(false)} onCreate={value => createMatter.mutate(value)} />}
    {showApproval && <ApprovalModal matters={matters.data || []} pending={createApproval.isPending} onClose={() => setShowApproval(false)} onCreate={(matterId, value) => createApproval.mutate({ matterId, value })} />}
  </div>;
};

export default LifecycleWorkspace;
