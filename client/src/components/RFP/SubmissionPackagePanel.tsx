import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

type Artifact = { id: string; artifactType: string; displayName: string; required: boolean; signatureRequired: boolean; signatureStatus: string; fileName?: string | null; storedDocumentId?: string | null; validationStatus: string };

async function api(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) };
  const response = await fetch(`/api${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'Package request failed'), { body });
  return body;
}

export default function SubmissionPackagePanel({ responseId, disabled }: { responseId: number; disabled?: boolean }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [findings, setFindings] = useState<Array<{ code: string; message: string }>>([]);
  const [busy, setBusy] = useState('');

  async function load() { const result = await api(`/rfp/responses/${responseId}/submission-package`); setArtifacts(result.artifacts || []); }
  useEffect(() => { load().catch(error => toast.error(error.message)); }, [responseId]);

  async function upload(artifact: Artifact, file?: File) {
    if (!file) return;
    setBusy(artifact.id);
    try {
      const form = new FormData(); form.append('document', file);
      const stored = await api('/storage/documents', { method: 'POST', body: form });
      await api(`/rfp/responses/${responseId}/submission-package/${artifact.artifactType}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, storedDocumentId: stored.document.id, completed: true, signatureStatus: artifact.signatureStatus }) });
      await load(); toast.success(`${artifact.displayName} secured`);
    } catch (error: any) { toast.error(error.message); } finally { setBusy(''); }
  }

  async function signature(artifact: Artifact, signed: boolean) {
    setBusy(artifact.id);
    try {
      await api(`/rfp/responses/${responseId}/submission-package/${artifact.artifactType}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signatureStatus: signed ? 'SIGNED' : 'PENDING' }) });
      await load();
    } catch (error: any) { toast.error(error.message); } finally { setBusy(''); }
  }

  async function validate() {
    setBusy('validate'); setFindings([]);
    try { const result = await api(`/rfp/responses/${responseId}/submission-package/validate`, { method: 'POST' }); setFindings(result.validation.findings || []); toast.success('Submission package is valid'); }
    catch (error: any) { setFindings(error.body?.validation?.findings || [{ code: 'VALIDATION_FAILED', message: error.message }]); }
    finally { setBusy(''); }
  }

  return <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-cyan-950">Final package files and signatures</h3><p className="text-xs text-cyan-800">Files are scanned, checksum-verified, encrypted, versioned, and retained. Portal submission remains human-controlled.</p></div><button type="button" disabled={disabled || Boolean(busy)} onClick={validate} className="rounded-lg bg-cyan-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === 'validate' ? 'Validating…' : 'Validate final package'}</button></div><div className="mt-3 grid gap-2 md:grid-cols-2">{artifacts.map(artifact => <div key={artifact.id} className="rounded-lg border border-cyan-100 bg-white p-3 text-xs"><div className="flex items-start justify-between gap-2"><div><strong>{artifact.displayName}</strong>{artifact.required && <span className="ml-1 text-red-700">required</span>}<div className="mt-1 text-gray-500">{artifact.fileName || (artifact.artifactType === 'PROPOSAL_DOCUMENT' ? 'Generated proposal draft' : 'No file uploaded')} · {artifact.validationStatus}</div></div>{artifact.artifactType !== 'PROPOSAL_DOCUMENT' && <label className="cursor-pointer font-semibold text-blue-700"><input className="hidden" type="file" disabled={disabled || Boolean(busy)} accept=".pdf,.doc,.docx,.txt" onChange={event => upload(artifact, event.target.files?.[0])} />{busy === artifact.id ? 'Securing…' : 'Upload'}</label>}</div>{artifact.signatureRequired && <label className="mt-2 flex items-center gap-2"><input type="checkbox" disabled={disabled || Boolean(busy)} checked={artifact.signatureStatus === 'SIGNED'} onChange={event => signature(artifact, event.target.checked)} />Authorized signature confirmed</label>}</div>)}</div>{findings.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-red-800">{findings.map((finding, index) => <li key={`${finding.code}-${index}`}>{finding.message}</li>)}</ul>}</div>;
}
