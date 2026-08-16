import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Brain, ChevronRight, Loader2 } from 'lucide-react';
import { contractsApi } from '../../services/contractsApi';
import { AI_REQUEST_PRESETS } from '../../features/aiQuickActionPresets';

const AIQuickActions: React.FC = () => {
  const navigate = useNavigate();
  const [contractId, setContractId] = useState('');
  const contractsQuery = useQuery({
    queryKey: ['ai-quick-action-contracts'],
    queryFn: () => contractsApi.getContracts(1, 100),
  });
  const contracts = contractsQuery.data?.data ?? [];

  useEffect(() => {
    if (!contracts.length) return;
    const saved = localStorage.getItem('lastContractId');
    setContractId(contracts.some(contract => contract.noticeId === saved) ? saved! : contracts[0].noticeId);
  }, [contracts]);

  const openStudio = (presetId: string) => {
    if (!contractId) return;
    localStorage.setItem('lastContractId', contractId);
    sessionStorage.setItem('aiQuickActionPreset', presetId);
    navigate('/ai/quick-actions');
  };

  return (
    <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-purple-100 p-2.5"><Brain className="h-5 w-5 text-purple-700" /></div>
        <div><h3 className="font-semibold text-slate-950">AI Capture Studio</h3><p className="mt-1 text-sm text-slate-500">Start with a complete request—not an empty contract ID.</p></div>
      </div>
      {contractsQuery.isLoading ? <div className="flex items-center gap-2 py-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading opportunities…</div> : contracts.length ? (
        <>
          <label className="mb-4 block text-sm font-medium text-slate-700">Opportunity
            <select value={contractId} onChange={event => setContractId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100">
              {contracts.map(contract => <option key={contract.noticeId} value={contract.noticeId}>{contract.noticeId} — {contract.title || 'Untitled opportunity'}</option>)}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {AI_REQUEST_PRESETS.slice(0, 4).map(preset => <button key={preset.id} onClick={() => openStudio(preset.id)} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-purple-300 hover:bg-purple-50">{preset.name}<ChevronRight className="h-4 w-4 text-purple-600" /></button>)}
          </div>
        </>
      ) : <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Import or seed a contract to enable AI analysis.</div>}
    </div>
  );
};

export default AIQuickActions;
