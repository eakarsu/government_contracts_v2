import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, Scale, ShieldCheck, Sparkles } from 'lucide-react';

interface AuthContextValue {
  signOut: () => Promise<void>;
  signingOut: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthGate');
  return context;
}

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) { setChecking(false); return; }
    localStorage.setItem('auth_token', token);
    localStorage.setItem('token', token);
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(response => {
        if (!response.ok) throw new Error('Session expired');
        setAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
      })
      .finally(() => setChecking(false));
  }, []);

  async function fillDemo() {
    setError('');
    const response = await fetch('/api/auth/demo-credentials', { cache: 'no-store' });
    if (!response.ok) { setError('Demo credentials are unavailable in this environment.'); return; }
    const credentials = await response.json();
    setEmail(credentials.email || '');
    setPassword(credentials.password || '');
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const body = await response.json();
      if (!response.ok || !body.token) throw new Error(body.error || 'Login failed');
      localStorage.setItem('auth_token', body.token);
      localStorage.setItem('token', body.token);
      setAuthenticated(true);
    } catch (loginError: any) { setError(loginError.message || 'Login failed'); }
    finally { setSubmitting(false); }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('searchHistory');
      localStorage.removeItem('lastContractId');
      localStorage.removeItem('lifecycleAiMatterId');
      localStorage.removeItem('deleted_rfp_ids');
      sessionStorage.clear();
      queryClient.clear();
      setEmail('');
      setPassword('');
      setAuthenticated(false);
      setSigningOut(false);
    }
  }

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><div className="loading-spinner border-white" /></div>;
  if (authenticated) return <AuthContext.Provider value={{ signOut, signingOut }}>{children}</AuthContext.Provider>;
  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.15fr_.85fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-12 lg:block">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" /><div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative"><div className="flex items-center gap-3"><div className="rounded-xl bg-white/10 p-3"><Scale className="h-7 w-7 text-blue-200" /></div><div><div className="font-semibold">Government Contract Intelligence</div><div className="text-xs uppercase tracking-[.24em] text-blue-200">Governed lifecycle platform</div></div></div>
          <h1 className="mt-16 max-w-xl text-4xl font-bold leading-tight">From opportunity discovery to compliant contract closeout.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">One evidence-backed workspace for lifecycle management, regulatory decisions, obligations, approvals, renewals, and accountable AI review.</p>
          <div className="mt-12 space-y-5">{[
            [ShieldCheck, 'Independent approvals and immutable audit evidence'], [Sparkles, 'Human-controlled AI grounded in contract records'], [LockKeyhole, 'OIDC-ready roles, permissions, and segregation of duties'],
          ].map(([Icon, text]: any) => <div className="flex items-center gap-4" key={text}><div className="rounded-lg bg-white/10 p-2"><Icon className="h-5 w-5 text-blue-200" /></div><span className="text-sm text-blue-50">{text}</span></div>)}</div>
        </div>
      </section>
      <section className="flex items-center bg-white p-7 text-gray-950 sm:p-12"><div className="w-full"><div className="lg:hidden"><Scale className="h-9 w-9 text-indigo-700" /></div><div className="text-sm font-semibold uppercase tracking-widest text-indigo-700">Authorized access</div><h2 className="mt-2 text-3xl font-bold">Sign in to your workspace</h2><p className="mt-2 text-sm leading-6 text-gray-500">Use your configured identity provider or local development administrator.</p>
        {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={signIn} className="mt-8 space-y-5"><label className="block"><span className="label">Email address</span><input className="input py-3" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label><label className="block"><span className="label">Password</span><input className="input py-3" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button className="btn-primary w-full py-3" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button></form>
        <button type="button" onClick={fillDemo} className="mt-3 w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Fill development credentials</button>
        <p className="mt-6 text-xs leading-5 text-gray-400">AI output is advisory. Authorized acquisition, legal, compliance, and business reviewers remain accountable for every consequential decision.</p>
      </div></section>
    </div>
  </main>;
};

export default AuthGate;
