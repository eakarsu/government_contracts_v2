import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, DollarSign, Target, Trophy, XCircle } from 'lucide-react';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { apiService } from '../services/api';
import type { RFPDashboardStats, RFPOutcomeAnalytics } from '../types';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

const RFPAnalytics: React.FC = () => {
  const [stats, setStats] = useState<RFPDashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<RFPOutcomeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiService.getRFPDashboardStats(), apiService.getRFPOutcomeAnalytics()])
      .then(([dashboard, outcomes]) => { setStats(dashboard.stats); setAnalytics(outcomes.analytics); })
      .catch(loadError => setError(loadError.message || 'Outcome analytics could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>;

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-7 text-white sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-300">Verified business outcomes</p><h1 className="mt-2 text-3xl font-bold">RFP Outcome Analytics</h1><p className="mt-2 text-sm text-slate-300">Calculated only from recorded won and lost decisions. No sample or hard-coded analytics are shown.</p></div><Link to="/rfp" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">Back to workspace</Link></header>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={card}><Target className="h-5 w-5 text-blue-700" /><strong className="mt-3 block text-3xl">{stats?.totalRFPs || 0}</strong><span className="text-sm text-slate-500">Proposal applications</span></div>
      <div className={card}><Trophy className="h-5 w-5 text-amber-600" /><strong className="mt-3 block text-3xl">{analytics?.winRate == null ? 'N/A' : `${analytics.winRate}%`}</strong><span className="text-sm text-slate-500">Actual win rate</span></div>
      <div className={card}><CheckCircle2 className="h-5 w-5 text-emerald-700" /><strong className="mt-3 block text-3xl">{analytics?.won || 0}</strong><span className="text-sm text-slate-500">Won</span></div>
      <div className={card}><DollarSign className="h-5 w-5 text-violet-700" /><strong className="mt-3 block text-3xl">${(analytics?.awardedValue || 0).toLocaleString()}</strong><span className="text-sm text-slate-500">Recorded awarded value</span></div>
    </div>
    <section className={card}><h2 className="font-semibold text-slate-900">Outcome distribution</h2><div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-emerald-50 p-4"><CheckCircle2 className="h-4 w-4 text-emerald-700" /><strong className="mt-2 block text-2xl text-emerald-900">{analytics?.won || 0}</strong><span className="text-xs text-emerald-700">Won</span></div><div className="rounded-xl bg-red-50 p-4"><XCircle className="h-4 w-4 text-red-700" /><strong className="mt-2 block text-2xl text-red-900">{analytics?.lost || 0}</strong><span className="text-xs text-red-700">Lost</span></div><div className="rounded-xl bg-amber-50 p-4"><AlertTriangle className="h-4 w-4 text-amber-700" /><strong className="mt-2 block text-2xl text-amber-900">{analytics?.withdrawn || 0}</strong><span className="text-xs text-amber-700">Withdrawn</span></div><div className="rounded-xl bg-slate-100 p-4"><Target className="h-4 w-4 text-slate-700" /><strong className="mt-2 block text-2xl text-slate-900">{analytics?.noBid || 0}</strong><span className="text-xs text-slate-600">No-bid</span></div></div>{analytics?.winRate == null && <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Record at least one won or lost submitted pursuit to calculate an actual win rate.</p>}</section>
  </div>;
};

export default RFPAnalytics;
