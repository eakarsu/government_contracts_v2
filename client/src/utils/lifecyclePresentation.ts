export function titleCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function statusTone(value: unknown) {
  const text = String(value || '').toUpperCase();
  if (/CRITICAL|HIGH|REJECTED|AT_RISK|FAILED|ON_HOLD/.test(text)) return 'badge-error';
  if (/APPROVED|ACCEPTED|SATISFIED|COMPLETED|CLEAR|EXECUTED/.test(text)) return 'badge-success';
  return 'badge-info';
}

export function formatLifecycleValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `${value.length} linked item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return `${Object.keys(value).length} evidence field${Object.keys(value).length === 1 ? '' : 's'}`;
  if (/Date|At|Deadline|Until/.test(field) && !Number.isNaN(Date.parse(String(value)))) return new Date(String(value)).toLocaleDateString();
  if (/price|value/i.test(field) && typeof value === 'number') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  if (/confidence|probability/i.test(field) && typeof value === 'number') return `${Math.round(value * 100)}%`;
  return String(value);
}
