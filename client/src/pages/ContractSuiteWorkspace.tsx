import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, Bot, BriefcaseBusiness, Building2,
  ChevronRight, FileSearch, Gavel, Plus, Search, ShieldCheck, Sparkles, Trophy, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { contractSuiteApi, SuiteDomain, SuiteWorkItem } from '../services/contractSuiteApi';
import { lifecycleApi } from '../services/lifecycleApi';
import { formatLifecycleValue, titleCase } from '../utils/lifecyclePresentation';

const icons: Record<string, React.ElementType> = {
  ACQUISITION: BriefcaseBusiness, NEGOTIATION: Gavel, VENDOR_RISK: Building2, SMART_CONTRACT: ShieldCheck, SPORTS: Trophy,
};
const colors: Record<string, string> = {
  ACQUISITION: 'from-blue-700 to-indigo-800', NEGOTIATION: 'from-violet-700 to-purple-900', VENDOR_RISK: 'from-emerald-700 to-teal-900',
  SMART_CONTRACT: 'from-slate-800 to-cyan-900', SPORTS: 'from-orange-600 to-rose-800',
};
const transitions: Record<string, string[]> = { OPEN: ['IN_REVIEW', 'BLOCKED'], IN_REVIEW: ['DECISION_REQUIRED', 'BLOCKED'], BLOCKED: ['IN_REVIEW'], DECISION_REQUIRED: ['APPROVED', 'BLOCKED'], APPROVED: ['CLOSED'], CLOSED: [] };

function tone(value: string) {
  if (/QUARANTINE|EXCLUDED/.test(value)) return 'bg-red-100 text-red-800';
  if (/MERGED|DESTINATION|DEDUPLICATED/.test(value)) return 'bg-emerald-100 text-emerald-800';
  if (['CRITICAL', 'BLOCKED', 'REJECTED'].includes(value)) return 'bg-red-100 text-red-800';
  if (['HIGH', 'DECISION_REQUIRED'].includes(value)) return 'bg-amber-100 text-amber-800';
  if (['APPROVED', 'CLOSED', 'LOW'].includes(value)) return 'bg-emerald-100 text-emerald-800';
  return 'bg-blue-100 text-blue-800';
}

const Pill = ({ value }: { value: string }) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone(value)}`}>{titleCase(value)}</span>;

function EvidenceView({ value }: { value: any }) {
  if (Array.isArray(value)) return <ul className="space-y-2">{value.map((entry, index) => <li key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">{typeof entry === 'object' ? <EvidenceView value={entry} /> : String(entry)}</li>)}</ul>;
  if (value && typeof value === 'object') return <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(value).filter(([, entry]) => entry !== null && entry !== '').map(([key, entry]) => <div key={key} className="rounded-lg border border-gray-200 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titleCase(key)}</dt><dd className="mt-1 text-sm leading-6 text-gray-900">{typeof entry === 'object' ? <EvidenceView value={entry} /> : formatLifecycleValue(key, entry)}</dd></div>)}</dl>;
  return <span>{String(value ?? '—')}</span>;
}

function AnalysisReport({ analysis }: { analysis: Record<string, any> }) {
  const output = analysis.output || {};
  return <section className="space-y-5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-semibold uppercase tracking-widest text-indigo-700">Advisory AI evidence</div><h3 className="mt-1 font-semibold text-gray-950">{titleCase(analysis.analysisType || 'analysis')}</h3></div><Pill value={analysis.status || 'PENDING_HUMAN_REVIEW'} /></div>
    <div><h4 className="text-sm font-semibold text-gray-900">Executive summary</h4><p className="mt-2 text-sm leading-6 text-gray-700">{output.summary}</p></div>
    <div><h4 className="text-sm font-semibold text-gray-900">Risk assessment</h4><div className="mt-2 space-y-2">{(output.riskAssessment || []).map((risk: any, index: number) => <div key={index} className="rounded-lg border border-gray-200 bg-white p-3"><div className="flex items-center justify-between gap-3"><span className="font-medium text-gray-900">{risk.finding}</span><Pill value={risk.severity || 'MEDIUM'} /></div><p className="mt-2 text-xs text-gray-500">Evidence: {risk.evidence || 'Independent validation required'}</p></div>)}</div></div>
    <div className="grid gap-4 lg:grid-cols-2"><div><h4 className="text-sm font-semibold text-gray-900">Evidence gaps</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">{(output.evidenceGaps || []).map((gap: string, index: number) => <li key={index}>{gap}</li>)}</ul></div><div><h4 className="text-sm font-semibold text-gray-900">Recommended actions</h4><div className="mt-2 space-y-2">{(output.recommendations || []).map((item: any, index: number) => <div key={index} className="rounded-lg bg-white p-3 text-sm"><div className="font-medium text-gray-900">{item.action}</div><div className="mt-1 text-xs text-gray-500">Owner: {item.owner} · {titleCase(item.priority || 'MEDIUM')}</div></div>)}</div></div></div>
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Human decision:</strong> {output.humanDecision}</div>
  </section>;
}

function DetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const client = useQueryClient();
  const [question, setQuestion] = useState('Assess this work item, identify evidence gaps, and recommend the next governed action.');
  const [rationale, setRationale] = useState('Evidence and accountable ownership reviewed.');
  const detail = useQuery({ queryKey: ['contract-suite-item', id], queryFn: () => contractSuiteApi.workItem(id) });
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['contract-suite-item', id] }), client.invalidateQueries({ queryKey: ['contract-suite-items'] }), client.invalidateQueries({ queryKey: ['contract-suite-overview'] })]); };
  const transition = useMutation({ mutationFn: (nextStatus: string) => contractSuiteApi.transition(id, nextStatus, rationale), onSuccess: async () => { toast.success('Workflow status updated'); await refresh(); }, onError: (error: any) => toast.error(error.response?.data?.error || error.message) });
  const review = useMutation({ mutationFn: () => contractSuiteApi.aiReview(id, question), onSuccess: async () => { toast.success('Advisory review recorded'); await refresh(); }, onError: (error: any) => toast.error(error.response?.data?.error || error.message) });
  const record = detail.data;
  return <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/55" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><div><div className="text-xs font-semibold uppercase tracking-widest text-primary-700">Governed work item</div><h2 className="mt-1 text-xl font-bold">{record?.title || 'Loading…'}</h2></div><button className="rounded-lg p-2 hover:bg-gray-100" onClick={onClose} aria-label="Close details"><X className="h-5 w-5" /></button></div>
    {detail.isLoading ? <div className="p-8">Loading evidence…</div> : record && <div className="space-y-7 p-5 sm:p-7">
      <div className="flex flex-wrap gap-2"><Pill value={record.status} /><Pill value={record.riskLevel} /><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{titleCase(record.capability)}</span></div>
      <p className="leading-7 text-gray-700">{record.summary}</p>
      <section><h3 className="mb-3 font-semibold">Decision context</h3><EvidenceView value={{ matter: record.matter?.matterNumber, agency: record.matter?.agency, owner: record.ownerId, counterparty: record.counterparty, monetaryValue: record.monetaryValue, probability: record.probability, dueDate: record.dueDate, jurisdiction: record.jurisdiction, chainId: record.chainId, league: record.league, recommendation: record.recommendation, sourceProject: record.sourceProject }} /></section>
      <section><h3 className="mb-3 font-semibold">Evidence snapshot</h3><EvidenceView value={record.evidence} /></section>
      {(transitions[record.status] || []).length > 0 && <section className="rounded-xl border border-gray-200 p-4"><h3 className="font-semibold">Human-controlled workflow</h3><p className="mt-1 text-sm text-gray-500">AI cannot change status. Record a rationale before an authorized transition.</p><textarea className="input mt-3 min-h-20" value={rationale} onChange={event => setRationale(event.target.value)} /><div className="mt-3 flex flex-wrap gap-2">{transitions[record.status].map(next => <button key={next} className={next === 'BLOCKED' ? 'btn-secondary' : 'btn-primary'} disabled={transition.isPending} onClick={() => transition.mutate(next)}>{titleCase(next)}</button>)}</div></section>}
      <section className="rounded-xl border border-indigo-200 p-4"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-indigo-700" /><h3 className="font-semibold">Ask AI with governed evidence</h3></div><textarea className="input mt-3 min-h-24" value={question} onChange={event => setQuestion(event.target.value)} /><button className="btn-primary mt-3 gap-2" disabled={review.isPending || !question.trim()} onClick={() => review.mutate()}><Sparkles className="h-4 w-4" />{review.isPending ? 'Analyzing…' : 'Run advisory review'}</button></section>
      <div className="space-y-4">{(record.analyses || []).map((analysis: any) => <AnalysisReport key={analysis.id} analysis={analysis} />)}</div>
    </div>}
  </aside></div>;
}

function CreateModal({ domain, onClose }: { domain: SuiteDomain; onClose: () => void }) {
  const client = useQueryClient();
  const matters = useQuery({ queryKey: ['lifecycle-records', 'matters', ''], queryFn: () => lifecycleApi.records('matters') });
  const [form, setForm] = useState<Record<string, any>>({ capability: domain.capabilities[0]?.key, priority: 'MEDIUM', riskLevel: 'MEDIUM', probability: '', evidence: {} });
  const set = (key: string, value: any) => setForm(current => ({ ...current, [key]: value }));
  const create = useMutation({ mutationFn: () => contractSuiteApi.create({ ...form, domain: domain.slug, sourceProject: 'government_contracts_v2', sourceRecordKey: `${domain.slug}-manual-${Date.now()}`, evidence: { intakeNotes: form.evidenceNotes || 'Evidence intake pending independent validation.' } }), onSuccess: async () => { toast.success('Work item created'); await client.invalidateQueries({ queryKey: ['contract-suite-items'] }); onClose(); }, onError: (error: any) => toast.error(error.response?.data?.error || error.message) });
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={event => { event.preventDefault(); create.mutate(); }} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-widest text-primary-700">{domain.label}</div><h2 className="mt-1 text-2xl font-bold">Create governed work item</h2></div><button type="button" className="p-2" onClick={onClose}><X /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">
    <label><span className="label">Contract matter</span><select className="input" required value={form.matterId || ''} onChange={e => set('matterId', e.target.value)}><option value="">Select matter</option>{matters.data?.map(matter => <option key={matter.id} value={matter.id}>{matter.matterNumber} — {matter.title}</option>)}</select></label>
    <label><span className="label">Capability</span><select className="input" value={form.capability} onChange={e => set('capability', e.target.value)}>{domain.capabilities.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
    <label className="sm:col-span-2"><span className="label">Title</span><input className="input" required value={form.title || ''} onChange={e => set('title', e.target.value)} /></label>
    <label className="sm:col-span-2"><span className="label">Summary</span><textarea className="input min-h-20" required value={form.summary || ''} onChange={e => set('summary', e.target.value)} /></label>
    <label><span className="label">Owner</span><input className="input" required value={form.ownerId || ''} onChange={e => set('ownerId', e.target.value)} /></label><label><span className="label">Counterparty</span><input className="input" value={form.counterparty || ''} onChange={e => set('counterparty', e.target.value)} /></label>
    <label><span className="label">Priority</span><select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>{['LOW','MEDIUM','HIGH','CRITICAL'].map(value => <option key={value}>{value}</option>)}</select></label><label><span className="label">Risk</span><select className="input" value={form.riskLevel} onChange={e => set('riskLevel', e.target.value)}>{['LOW','MEDIUM','HIGH','CRITICAL'].map(value => <option key={value}>{value}</option>)}</select></label>
    <label><span className="label">Due date</span><input className="input" type="date" value={form.dueDate || ''} onChange={e => set('dueDate', e.target.value)} /></label><label><span className="label">Probability (0–1)</span><input className="input" type="number" min="0" max="1" step="0.01" value={form.probability} onChange={e => set('probability', e.target.value)} /></label>
    <label className="sm:col-span-2"><span className="label">Recommendation</span><textarea className="input min-h-20" required value={form.recommendation || ''} onChange={e => set('recommendation', e.target.value)} /></label><label className="sm:col-span-2"><span className="label">Evidence notes</span><textarea className="input min-h-20" value={form.evidenceNotes || ''} onChange={e => set('evidenceNotes', e.target.value)} /></label>
  </div><div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create work item'}</button></div></form></div>;
}

const ContractSuiteWorkspace: React.FC = () => {
  const { domain: domainSlug } = useParams();
  const [capability, setCapability] = useState(''); const [search, setSearch] = useState(''); const [selected, setSelected] = useState(''); const [showCreate, setShowCreate] = useState(false);
  const catalog = useQuery({ queryKey: ['contract-suite-catalog'], queryFn: contractSuiteApi.catalog });
  const overview = useQuery({ queryKey: ['contract-suite-overview'], queryFn: contractSuiteApi.overview });
  const domain = catalog.data?.domains.find(item => item.slug === domainSlug);
  useEffect(() => { setCapability(''); setSearch(''); setSelected(''); }, [domainSlug]);
  const items = useQuery({ queryKey: ['contract-suite-items', domainSlug, capability, search], queryFn: () => contractSuiteApi.workItems({ domain: domainSlug, capability: capability || undefined, search: search || undefined }), enabled: Boolean(domain) });
  const capabilityLabel = useMemo(() => Object.fromEntries((domain?.capabilities || []).map(item => [item.key, item.label])), [domain]);
  if (catalog.isLoading || overview.isLoading) return <div className="flex h-64 items-center justify-center">Loading consolidated contract suite…</div>;
  if (!domainSlug) return <div className="space-y-8"><header><div className="text-sm font-semibold uppercase tracking-widest text-primary-700">Deduplicated portfolio</div><h1 className="mt-2 text-3xl font-bold">Unified Contract Intelligence Suite</h1><p className="mt-2 max-w-4xl leading-7 text-gray-600">Unique capabilities from the contract projects now share the existing matter, evidence, approval, identity, and audit foundation. Duplicate lifecycle features remain in their authoritative workspace.</p></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border bg-white p-5"><Activity className="h-5 w-5 text-primary-700" /><div className="mt-3 text-3xl font-bold">{overview.data?.total || 0}</div><div className="text-sm text-gray-500">Consolidated work items</div></div><div className="rounded-xl border bg-white p-5"><AlertTriangle className="h-5 w-5 text-red-600" /><div className="mt-3 text-3xl font-bold">{overview.data?.highRisk || 0}</div><div className="text-sm text-gray-500">Open high-risk decisions</div></div><div className="rounded-xl border bg-white p-5"><FileSearch className="h-5 w-5 text-amber-600" /><div className="mt-3 text-3xl font-bold">{overview.data?.dueSoon || 0}</div><div className="text-sm text-gray-500">Due within 30 days</div></div><div className="rounded-xl border bg-white p-5"><Bot className="h-5 w-5 text-indigo-600" /><div className="mt-3 text-3xl font-bold">{overview.data?.pendingHumanReview || 0}</div><div className="text-sm text-gray-500">AI reports awaiting humans</div></div></div>
    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{catalog.data?.domains.map(item => { const Icon = icons[item.key] || BriefcaseBusiness; return <Link key={item.key} to={`/contract-suite/${item.slug}`} className={`group rounded-2xl bg-gradient-to-br ${colors[item.key]} p-6 text-white shadow-lg transition hover:-translate-y-1`}><div className="flex items-center justify-between"><div className="rounded-xl bg-white/15 p-3"><Icon className="h-6 w-6" /></div><div className="text-3xl font-bold">{overview.data?.domains?.[item.key] || 0}</div></div><h2 className="mt-5 text-xl font-bold">{item.label}</h2><p className="mt-2 min-h-20 text-sm leading-6 text-white/80">{item.description}</p><div className="mt-4 flex items-center gap-2 text-sm font-semibold">{item.capabilities.length} unique capabilities <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></div></Link>; })}</section>
    <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Source consolidation register</h2><p className="mt-2 text-sm text-gray-600">{catalog.data?.duplicatePolicy}</p><div className="mt-5 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500"><th className="px-3 py-3">Project</th><th className="px-3 py-3">Disposition</th><th className="px-3 py-3">Result</th></tr></thead><tbody>{catalog.data?.sources.map(source => <tr key={source.project} className="border-b last:border-0"><td className="px-3 py-4 font-semibold">{source.project}</td><td className="px-3 py-4"><Pill value={source.disposition} /></td><td className="px-3 py-4 text-gray-600">{source.note}</td></tr>)}</tbody></table></div></section>
  </div>;
  if (!domain) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unknown contract workspace. <Link className="font-semibold underline" to="/contract-suite">Return to the suite</Link>.</div>;
  const Icon = icons[domain.key] || BriefcaseBusiness;
  return <div className="space-y-6"><header className={`rounded-2xl bg-gradient-to-r ${colors[domain.key]} p-6 text-white shadow-lg`}><Link to="/contract-suite" className="text-sm font-medium text-white/80 hover:text-white">← Unified contract suite</Link><div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="flex items-center gap-3"><Icon className="h-7 w-7" /><h1 className="text-3xl font-bold">{domain.label}</h1></div><p className="mt-3 max-w-3xl leading-7 text-white/80">{domain.description}</p></div><button className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow hover:bg-gray-50" onClick={() => setShowCreate(true)}><Plus className="mr-2 inline h-4 w-4" />New work item</button></div></header>
    <section className="rounded-xl border bg-white p-4"><div className="flex flex-wrap gap-2"><button className={`rounded-full px-3 py-2 text-sm font-semibold ${!capability ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setCapability('')}>All ({overview.data?.domains?.[domain.key] || 0})</button>{domain.capabilities.map(item => <button key={item.key} className={`rounded-full px-3 py-2 text-sm font-semibold ${capability === item.key ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} onClick={() => setCapability(item.key)}>{item.label}</button>)}</div><div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder={`Search ${domain.label.toLowerCase()}`} value={search} onChange={event => setSearch(event.target.value)} /></div></section>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-semibold">Decision work queue</h2><p className="text-sm text-gray-500">{items.data?.length || 0} records · source: {domain.sourceProject}</p></div><div className="divide-y">{items.isLoading ? <div className="p-6">Loading work queue…</div> : items.data?.map(item => <button key={item.id} className="grid w-full gap-3 p-5 text-left transition hover:bg-gray-50 lg:grid-cols-[1fr_180px_140px_130px_28px] lg:items-center" onClick={() => setSelected(item.id)}><div><div className="font-semibold text-gray-950">{item.title}</div><p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.summary}</p><div className="mt-2 text-xs text-gray-400">{item.matter?.matterNumber} · {capabilityLabel[item.capability] || titleCase(item.capability)}</div></div><div className="text-sm"><div className="text-xs uppercase text-gray-400">Owner</div><div className="mt-1 font-medium">{item.ownerId}</div></div><div><Pill value={item.riskLevel} /></div><div><Pill value={item.status} /></div><ArrowRight className="hidden h-4 w-4 text-gray-400 lg:block" /></button>)}{!items.isLoading && !items.data?.length && <div className="p-10 text-center text-gray-500">No work items match these filters.</div>}</div></section>
    {selected && <DetailPanel id={selected} onClose={() => setSelected('')} />}{showCreate && <CreateModal domain={domain} onClose={() => setShowCreate(false)} />}
  </div>;
};

export default ContractSuiteWorkspace;
