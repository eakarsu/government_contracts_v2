import React, { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

type Json = Record<string, any>;

async function request(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="card p-6"><h2 className="text-lg font-semibold text-gray-900">{title}</h2><div className="mt-4">{children}</div></section>;

export default function ProductionOperations() {
  const [readiness, setReadiness] = useState<Json | null>(null);
  const [tasks, setTasks] = useState<Json | null>(null);
  const [events, setEvents] = useState<Json[]>([]);
  const [members, setMembers] = useState<Json[]>([]);
  const [restricted, setRestricted] = useState<string[]>([]);
  const [channel, setChannel] = useState('IN_APP');
  const [destination, setDestination] = useState('');
  const [member, setMember] = useState({ subject: '', email: '' });
  const [savedSearch, setSavedSearch] = useState({ name: '', keyword: '' });

  async function load() {
    const calls = await Promise.allSettled([
      request('/operations/readiness'), request('/operations/tasks'), request('/notifications/events'), request('/tenant-admin/memberships'),
    ]);
    if (calls[0].status === 'fulfilled') setReadiness(calls[0].value); else setRestricted(value => [...value, 'Operational readiness']);
    if (calls[1].status === 'fulfilled') setTasks(calls[1].value); else setRestricted(value => [...value, 'Durable tasks']);
    if (calls[2].status === 'fulfilled') setEvents(calls[2].value.events || []); else setRestricted(value => [...value, 'Notifications']);
    if (calls[3].status === 'fulfilled') setMembers(calls[3].value.memberships || []); else setRestricted(value => [...value, 'Tenant administration']);
  }

  useEffect(() => { load(); }, []);

  async function subscribe(event: FormEvent) {
    event.preventDefault();
    try {
      await request('/notifications/subscriptions', { method: 'POST', body: JSON.stringify({ channel, destination, eventTypes: ['NEW_OPPORTUNITY', 'AMENDMENT', 'DEADLINE', 'REVIEW_ASSIGNED', 'FAILED_JOB', 'SUBMISSION_STATUS'] }) });
      setDestination(''); toast.success('Notification subscription saved');
    } catch (error: any) { toast.error(error.message); }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    try {
      await request('/tenant-admin/memberships', { method: 'POST', body: JSON.stringify({ ...member, roles: ['contract_viewer'] }) });
      setMember({ subject: '', email: '' }); toast.success('User membership saved'); await load();
    } catch (error: any) { toast.error(error.message); }
  }

  async function saveSearch(event: FormEvent) {
    event.preventDefault();
    try {
      await request('/notifications/saved-searches', { method: 'POST', body: JSON.stringify({ name: savedSearch.name, query: { keyword: savedSearch.keyword }, cadence: 'DAILY' }) });
      setSavedSearch({ name: '', keyword: '' }); toast.success('Saved search alert created');
    } catch (error: any) { toast.error(error.message); }
  }

  return <div className="space-y-6">
    <header><div className="text-sm font-semibold uppercase tracking-widest text-primary-700">Production controls</div><h1 className="mt-2 text-3xl font-bold text-gray-900">Operations & Alerts</h1><p className="mt-2 max-w-4xl text-gray-600">Monitor restart-safe work, configure delivery channels, and administer OIDC tenant membership. External destinations are encrypted and never returned by the API.</p></header>
    {restricted.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your role cannot access: {Array.from(new Set(restricted)).join(', ')}.</div>}
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Production readiness">{readiness ? <><div className="text-xl font-semibold">{readiness.status}</div><ul className="mt-3 space-y-2 text-sm">{(readiness.checks || []).map((check: Json) => <li key={check.name} className="flex justify-between"><span>{check.name.replaceAll('_', ' ')}</span><span className="font-semibold uppercase">{check.status}</span></li>)}</ul></> : <p className="text-sm text-gray-500">Readiness data unavailable.</p>}</Panel>
      <Panel title="Durable pipeline">{tasks ? <><div className="flex flex-wrap gap-3">{Object.entries(tasks.counts || {}).map(([status, count]) => <span key={status} className="rounded-full bg-gray-100 px-3 py-1 text-sm">{status}: {String(count)}</span>)}</div><div className="mt-4 max-h-56 overflow-auto text-sm">{(tasks.tasks || []).slice(0, 20).map((task: Json) => <div key={task.id} className="border-t py-2"><b>{task.taskType}</b> · {task.status} · attempts {task.attempts}/{task.maxAttempts}</div>)}</div></> : <p className="text-sm text-gray-500">Task data unavailable.</p>}</Panel>
      <Panel title="Notification delivery"><form onSubmit={subscribe} className="space-y-3"><select className="input" value={channel} onChange={event => setChannel(event.target.value)}><option>IN_APP</option><option>EMAIL</option><option>CALENDAR</option><option>TEAMS</option><option>SLACK</option></select>{channel !== 'IN_APP' && <input className="input" required value={destination} onChange={event => setDestination(event.target.value)} placeholder={channel === 'EMAIL' || channel === 'CALENDAR' ? 'Email address' : 'HTTPS webhook URL'} />}<button className="btn-primary">Save subscription</button></form><form onSubmit={saveSearch} className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2"><input className="input" required value={savedSearch.name} onChange={event => setSavedSearch({ ...savedSearch, name: event.target.value })} placeholder="Saved search name" /><input className="input" required value={savedSearch.keyword} onChange={event => setSavedSearch({ ...savedSearch, keyword: event.target.value })} placeholder="Opportunity keyword" /><button className="btn-secondary sm:col-span-2">Create daily opportunity alert</button></form><div className="mt-5 max-h-48 overflow-auto text-sm">{events.slice(0, 20).map(item => <div key={item.id} className="border-t py-2"><b>{item.subject}</b><div className="text-gray-500">{item.channel} · {item.status}</div></div>)}</div></Panel>
      <Panel title="Tenant users"><form onSubmit={addMember} className="space-y-3"><input className="input" required value={member.subject} onChange={event => setMember({ ...member, subject: event.target.value })} placeholder="OIDC subject identifier" /><input className="input" type="email" required value={member.email} onChange={event => setMember({ ...member, email: event.target.value })} placeholder="User email" /><button className="btn-primary">Add viewer</button></form><div className="mt-5 max-h-48 overflow-auto text-sm">{members.map(item => <div key={item.id} className="border-t py-2"><b>{item.email}</b><div className="text-gray-500">{item.roles.join(', ')} · {item.status}</div></div>)}</div></Panel>
    </div>
  </div>;
}
