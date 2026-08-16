import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, DatabaseZap, FileCheck2, Scale, ShieldCheck } from 'lucide-react';
import { lifecycleApi } from '../services/lifecycleApi';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const tabs = [
  { key: 'evaluations' as const, label: 'Compliance Decisions', icon: FileCheck2 },
  { key: 'policies' as const, label: 'Policies', icon: BookOpenCheck },
  { key: 'sources' as const, label: 'Regulatory Sources', icon: DatabaseZap },
];

function present(value: any) {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return `${value.length} linked evidence items`;
  if (typeof value === 'object') return `${Object.keys(value).length} governed fields`;
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value.includes('T')) return new Date(value).toLocaleDateString();
  return String(value).replace(/_/g, ' ');
}

const fields = {
  evaluations: ['contractId', 'scenario', 'status', 'riskRating', 'ownerId', 'policyKey', 'policyVersion', 'evaluatedAt'],
  policies: ['policyKey', 'version', 'title', 'jurisdiction', 'effectiveFrom', 'effectiveTo', 'createdBy'],
  sources: ['sourceKey', 'version', 'title', 'authority', 'documentIdentifier', 'jurisdiction', 'retrievedAt'],
};

const GovernanceWorkspace: React.FC = () => {
  const [tab, setTab] = useState<'evaluations' | 'policies' | 'sources'>('evaluations');
  const overview = useQuery({ queryKey: ['governance-overview'], queryFn: lifecycleApi.governanceOverview });
  const records = useQuery({ queryKey: ['governance-records', tab], queryFn: () => lifecycleApi.governanceRecords(tab) });
  if (overview.isLoading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>;
  return <div className="space-y-7">
    <div><div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-indigo-700"><Scale className="h-4 w-4" /> Authoritative decision layer</div><h1 className="mt-2 text-3xl font-bold">Government Compliance Governance</h1><p className="mt-2 max-w-3xl text-gray-600">Versioned policies and authoritative regulatory sources control evidence-backed decisions. AI remains advisory and cannot release a decision.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
      ['Policies', overview.data?.policies, BookOpenCheck], ['Sources', overview.data?.sources, DatabaseZap], ['Evaluations', overview.data?.evaluations, FileCheck2], ['Approved', overview.data?.statuses?.APPROVED || 0, ShieldCheck],
    ].map(([label, value, Icon]: any) => <article className="card" key={label}><Icon className="h-6 w-6 text-indigo-600" /><div className="mt-4 text-3xl font-bold">{value || 0}</div><div className="text-sm text-gray-500">{label}</div></article>)}</div>
    <div className="flex flex-wrap gap-2 border-b">{tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}><item.icon className="h-4 w-4" />{item.label}</button>)}</div>
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">{records.isLoading ? <div className="flex h-56 items-center justify-center"><LoadingSpinner /></div> : <div className="overflow-x-auto"><table className="min-w-full divide-y"><thead className="bg-gray-50"><tr>{fields[tab].map(field => <th key={field} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{field.replace(/([A-Z])/g, ' $1')}</th>)}</tr></thead><tbody className="divide-y">{records.data?.map(row => <tr key={row.id} className="hover:bg-gray-50">{fields[tab].map(field => <td key={field} className="max-w-xs px-4 py-3 text-sm text-gray-700"><span className={field === 'status' || field === 'riskRating' ? 'badge-info' : ''}>{present(row[field])}</span></td>)}</tr>)}</tbody></table></div>}</div>
  </div>;
};

export default GovernanceWorkspace;
