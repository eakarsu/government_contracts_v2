import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, Building2, CheckCircle2, ChevronDown, Loader2, Play, Sparkles } from 'lucide-react';
import { aiService } from '../services/aiService';
import { contractsApi } from '../services/contractsApi';
import type { Contract } from '../types';
import {
  AI_REQUEST_PRESETS,
  AiQuickActionType,
  AiRequestForm,
  contextStorageKey,
  hasCompleteAiRequest,
  toUserContext,
} from '../features/aiQuickActionPresets';

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100';

const AIQuickActionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [contractId, setContractId] = useState('');
  const initialPreset = AI_REQUEST_PRESETS.find(preset => preset.id === sessionStorage.getItem('aiQuickActionPreset')) ?? AI_REQUEST_PRESETS[0];
  const [activePreset, setActivePreset] = useState(initialPreset);
  const [request, setRequest] = useState<AiRequestForm>(initialPreset.values);

  const contractsQuery = useQuery({
    queryKey: ['ai-quick-action-contracts'],
    queryFn: () => contractsApi.getContracts(1, 100),
  });
  const contracts = contractsQuery.data?.data ?? [];

  useEffect(() => {
    if (!contracts.length) return;
    const saved = localStorage.getItem('lastContractId');
    const selected = contracts.find(contract => contract.noticeId === saved) ?? contracts[0];
    setContractId(selected.noticeId);
  }, [contracts]);

  const selectedContract = useMemo(
    () => contracts.find(contract => contract.noticeId === contractId),
    [contracts, contractId],
  );

  const analysisMutation = useMutation({
    mutationFn: async ({ type, id }: { type: AiQuickActionType; id: string }) => {
      const context = toUserContext(request);
      if (type === 'probability') return aiService.predictWinProbability(id, context);
      if (type === 'similarity') return aiService.findSimilarContracts(id, 10, context);
      if (type === 'strategy') return aiService.optimizeBidStrategy(id, context);
      return aiService.getComprehensiveAnalysis(id, 'current-user', context);
    },
    onSuccess: (_data, variables) => {
      const paths: Record<AiQuickActionType, string> = {
        comprehensive: 'analysis-results', probability: 'win-probability',
        similarity: 'similar-contracts', strategy: 'bid-strategy',
      };
      navigate(`/ai/${paths[variables.type]}/${variables.id}`);
    },
  });

  const choosePreset = (preset: typeof AI_REQUEST_PRESETS[number]) => {
    setActivePreset(preset);
    setRequest({ ...preset.values });
    sessionStorage.setItem('aiQuickActionPreset', preset.id);
  };

  const runAnalysis = () => {
    if (!contractId || !hasCompleteAiRequest(request)) return;
    const context = toUserContext(request);
    localStorage.setItem('lastContractId', contractId);
    sessionStorage.setItem(contextStorageKey(contractId), JSON.stringify(context));
    analysisMutation.mutate({ type: activePreset.action, id: contractId });
  };

  const update = <K extends keyof AiRequestForm>(key: K, value: AiRequestForm[K]) =>
    setRequest(current => ({ ...current, [key]: value }));

  const textFields: Array<{ key: keyof AiRequestForm; label: string; placeholder: string }> = [
    { key: 'certifications', label: 'Certifications', placeholder: '8(a), HUBZone, WOSB' },
    { key: 'experienceInNaics', label: 'Experienced NAICS codes', placeholder: '541511, 541512' },
    { key: 'agencyRelationships', label: 'Agency relationships', placeholder: 'DoD, GSA, DHS' },
    { key: 'pastWins', label: 'Relevant past wins', placeholder: 'Program names or outcomes' },
    { key: 'preferredNaicsCodes', label: 'Preferred NAICS codes', placeholder: '541511, 541519' },
    { key: 'preferredAgencies', label: 'Preferred agencies', placeholder: 'DoD, GSA' },
    { key: 'preferredStates', label: 'Preferred states', placeholder: 'VA, MD, DC' },
    { key: 'keywords', label: 'Capture keywords', placeholder: 'cloud, cybersecurity, analytics' },
  ];

  const ready = Boolean(contractId) && hasCompleteAiRequest(request);

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <button onClick={() => navigate('/')} className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="mb-7 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-900 px-6 py-8 text-white shadow-xl sm:px-9">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-purple-200"><Sparkles className="h-4 w-4" /> AI Capture Studio</div>
        <h1 className="text-3xl font-bold sm:text-4xl">Build a complete AI request</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">Choose a real opportunity, fill every company and capture field with a professional preset, review the context, then run the analysis.</p>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3"><Building2 className="h-5 w-5 text-purple-600" /><div><h2 className="font-semibold text-slate-950">1. Select an opportunity</h2><p className="text-sm text-slate-500">Only real contracts from your database are available.</p></div></div>
        {contractsQuery.isLoading ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading contracts…</div> : contractsQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Contracts could not be loaded. Refresh after confirming the API connection.</div>
        ) : contracts.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No contracts are available. Seed or import an opportunity before requesting AI analysis.</div>
        ) : (
          <div className="relative"><select value={contractId} onChange={event => setContractId(event.target.value)} className={`${fieldClass} appearance-none pr-10`} aria-label="Contract for AI analysis">
            {contracts.map((contract: Contract) => <option key={contract.noticeId} value={contract.noticeId}>{contract.noticeId} — {contract.title || 'Untitled opportunity'} ({contract.agency || 'Agency not listed'})</option>)}
          </select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-slate-500" /></div>
        )}
        {selectedContract && <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">{selectedContract.agency || 'Agency not listed'}</span><span className="rounded-full bg-purple-50 px-3 py-1.5 font-medium text-purple-700">NAICS {selectedContract.naicsCode || 'not listed'}</span></div>}
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4"><h2 className="font-semibold text-slate-950">2. Fill a complete AI request</h2><p className="text-sm text-slate-500">Each preset fills every supported field. You can edit any value before running it.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AI_REQUEST_PRESETS.map(preset => <button key={preset.id} type="button" onClick={() => choosePreset(preset)} className={`rounded-2xl border p-4 text-left transition ${activePreset.id === preset.id ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-100' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-950">{preset.name}</span>{activePreset.id === preset.id && <CheckCircle2 className="h-5 w-5 text-purple-600" />}</div><p className="mt-2 text-sm leading-5 text-slate-600">{preset.description}</p><span className="mt-3 inline-block text-xs font-semibold uppercase tracking-wide text-purple-700">Fills all fields</span>
          </button>)}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5"><h2 className="font-semibold text-slate-950">3. Review company and capture context</h2><p className="text-sm text-slate-500">Comma-separated entries are sent as structured lists, not as raw text.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Annual revenue ($)<input type="number" min="1" value={request.annualRevenue} onChange={e => update('annualRevenue', Number(e.target.value))} className={`${fieldClass} mt-1.5`} /></label>
          <label className="text-sm font-medium text-slate-700">Minimum contract value ($)<input type="number" min="0" value={request.minContractValue} onChange={e => update('minContractValue', Number(e.target.value))} className={`${fieldClass} mt-1.5`} /></label>
          {textFields.map(field => <label key={field.key} className="text-sm font-medium text-slate-700">{field.label}<input value={String(request[field.key])} onChange={e => update(field.key, e.target.value as never)} placeholder={field.placeholder} className={`${fieldClass} mt-1.5`} /></label>)}
          <label className="text-sm font-medium text-slate-700">Maximum opportunity age (days)<input type="number" min="1" value={request.maxAgeDays} onChange={e => update('maxAgeDays', Number(e.target.value))} className={`${fieldClass} mt-1.5`} /></label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={request.hasBonding} onChange={e => update('hasBonding', e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-purple-600" /> Bonding capacity confirmed</label>
        </div>
      </section>

      <section className="rounded-2xl border border-purple-200 bg-purple-50 p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-6">
        <div><div className="flex items-center gap-2 font-semibold text-slate-950"><Brain className="h-5 w-5 text-purple-700" /> Ready: {activePreset.name}</div><p className="mt-1 text-sm text-slate-600">Runs {activePreset.action.replace('-', ' ')} analysis with the complete context above.</p></div>
        <button onClick={runAnalysis} disabled={!ready || analysisMutation.isPending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-6 py-3.5 font-semibold text-white shadow-lg transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0 sm:w-auto">
          {analysisMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing…</> : <><Play className="h-5 w-5" /> Run AI analysis</>}
        </button>
      </section>
      {analysisMutation.isError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{analysisMutation.error instanceof Error ? analysisMutation.error.message : 'AI analysis failed. Please try again.'}</div>}
    </div>
  );
};

export default AIQuickActionsPage;
