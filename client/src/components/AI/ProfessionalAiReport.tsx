import React from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, ShieldCheck, Sparkles } from 'lucide-react';
import { formatLifecycleValue, titleCase } from '../../utils/lifecyclePresentation';

type ProfessionalAiReportProps = {
  value: unknown;
  title?: string;
  subtitle?: string;
  model?: string;
  status?: string;
  dark?: boolean;
};

function parseValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().replace(/^```(?:json|javascript|markdown)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
    try { return JSON.parse(cleaned); } catch (_error) { return cleaned; }
  }
  return cleaned;
}

function isUrl(value: string) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch (_error) { return false; } }

function scalar(field: string, value: unknown, dark = false) {
  if (value === null || value === undefined || value === '') return <span className={dark ? 'text-blue-200' : 'text-gray-400'}>Not supplied</span>;
  if (typeof value === 'boolean') return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${value ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{value ? 'Yes' : 'No'}</span>;
  const rendered = formatLifecycleValue(field, value);
  if (typeof value === 'string' && isUrl(value)) return <a className="font-medium text-blue-600 underline" href={value} target="_blank" rel="noreferrer">Open evidence source</a>;
  return <span className="whitespace-pre-wrap break-words">{rendered}</span>;
}

function textBlocks(value: string, dark: boolean) {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`list-${blocks.length}`} className="space-y-2">{bullets.map((line, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{line.replace(/^[-*•]\s*|^\d+[.)]\s*/, '')}</span></li>)}</ul>);
    bullets = [];
  };
  lines.forEach(line => {
    if (/^[-*•]\s+|^\d+[.)]\s+/.test(line)) { bullets.push(line); return; }
    flushBullets();
    if (/^#{1,6}\s+/.test(line) || (/^[A-Z][A-Za-z\s/&-]{2,40}:?$/.test(line) && line.length < 52)) {
      blocks.push(<h4 key={`heading-${blocks.length}`} className={`pt-2 font-semibold ${dark ? 'text-white' : 'text-gray-950'}`}>{line.replace(/^#{1,6}\s+/, '').replace(/:$/, '')}</h4>);
    } else blocks.push(<p key={`paragraph-${blocks.length}`} className="leading-7">{line}</p>);
  });
  flushBullets();
  return <div className={`space-y-3 text-sm ${dark ? 'text-blue-50' : 'text-gray-700'}`}>{blocks}</div>;
}

function StructuredValue({ value, field = 'report', dark = false, depth = 0 }: { value: unknown; field?: string; dark?: boolean; depth?: number }) {
  const parsed = parseValue(value);
  if (typeof parsed === 'string') return textBlocks(parsed, dark);
  if (parsed === null || parsed === undefined || typeof parsed !== 'object') return <div className="text-sm">{scalar(field, parsed, dark)}</div>;
  if (Array.isArray(parsed)) {
    if (!parsed.length) return <div className={`rounded-lg border border-dashed p-3 text-sm ${dark ? 'border-white/20 text-blue-200' : 'border-gray-300 text-gray-500'}`}>No findings reported.</div>;
    return <div className="space-y-3">{parsed.map((entry, index) => <div key={index} className={`rounded-xl border p-4 ${dark ? 'border-white/15 bg-white/10' : 'border-gray-200 bg-white'}`}><div className="flex gap-3"><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dark ? 'bg-white/15 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{index + 1}</div><div className="min-w-0 flex-1"><StructuredValue value={entry} field={`${field}-${index}`} dark={dark} depth={depth + 1} /></div></div></div>)}</div>;
  }
  const entries = Object.entries(parsed as Record<string, unknown>).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '');
  const scalarEntries = entries.filter(([, entry]) => typeof entry !== 'object');
  const complexEntries = entries.filter(([, entry]) => typeof entry === 'object');
  return <div className="space-y-5">
    {scalarEntries.length > 0 && <dl className={`grid gap-3 ${depth > 1 ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>{scalarEntries.map(([key, entry]) => <div key={key} className={`rounded-lg border p-3 ${dark ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50'}`}><dt className={`text-xs font-semibold uppercase tracking-wide ${dark ? 'text-blue-200' : 'text-gray-500'}`}>{titleCase(key)}</dt><dd className={`mt-1 text-sm leading-6 ${dark ? 'text-white' : 'text-gray-900'}`}>{scalar(key, entry, dark)}</dd></div>)}</dl>}
    {complexEntries.map(([key, entry]) => <section key={key}><h4 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${dark ? 'text-white' : 'text-gray-950'}`}><Lightbulb className="h-4 w-4 text-amber-500" />{titleCase(key)}</h4><StructuredValue value={entry} field={key} dark={dark} depth={depth + 1} /></section>)}
  </div>;
}

const ProfessionalAiReport: React.FC<ProfessionalAiReportProps> = ({ value, title = 'AI Analysis Report', subtitle = 'Structured advisory assessment', model, status = 'Human review required', dark = false }) => (
  <article className={`overflow-hidden rounded-2xl border shadow-sm ${dark ? 'border-white/15 bg-white/10' : 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/50'}`}>
    <header className={`border-b p-5 ${dark ? 'border-white/15 bg-white/5' : 'border-indigo-100 bg-white/80'}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] ${dark ? 'text-blue-200' : 'text-indigo-700'}`}><Sparkles className="h-4 w-4" />AI analysis complete</div><h3 className={`mt-2 text-xl font-bold ${dark ? 'text-white' : 'text-gray-950'}`}>{title}</h3><p className={`mt-1 text-sm ${dark ? 'text-blue-100' : 'text-gray-500'}`}>{subtitle}</p></div><div className="flex flex-wrap gap-2">{model && <span className={`rounded-full px-3 py-1 text-xs font-medium ${dark ? 'bg-white/10 text-blue-100' : 'bg-gray-100 text-gray-700'}`}>{model}</span>}<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"><ShieldCheck className="h-3.5 w-3.5" />{titleCase(status)}</span></div></div>
    </header>
    <div className="p-5"><StructuredValue value={value} dark={dark} /></div>
    <footer className={`flex gap-2 border-t p-4 text-xs ${dark ? 'border-white/15 text-blue-200' : 'border-indigo-100 text-gray-500'}`}><AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /><span>Advisory output only. Verify cited evidence and record an authorized human decision before taking consequential action.</span></footer>
  </article>
);

export default ProfessionalAiReport;
