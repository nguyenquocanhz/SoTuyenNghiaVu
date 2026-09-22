/**
 * Vietnamese number/date formatting without relying on Intl (Hermes builds may
 * ship without full ICU data). Decimal separator is a comma.
 */
export function formatNumber(value: number | undefined | null, digits = 1): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—';
  // Round with roundTo first so the displayed digits always match the value the
  // classifiers use (toFixed alone rounds 22.95 down to "22.9" because of binary noise)
  // and so a tiny negative never shows as "-0,0".
  const fixed = roundTo(value, digits).toFixed(digits);
  const [int, frac] = fixed.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const grouped = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return frac ? `${sign}${grouped},${frac}` : `${sign}${grouped}`;
}

/** Parses user input accepting both "65,4" and "65.4". Returns undefined when invalid. */
export function parseDecimal(input: string): number | undefined {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return undefined;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Decimal rounding, halves away from zero (22.95 → 23.0, -1.25 → -1.3, 1.005 → 1.01).
 * `toPrecision(15)` strips binary noise from the scaled value (1.005 × 100 = 100.49999999999999)
 * so halves round like the decimal number the user reads.
 */
export function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;
  const f = 10 ** digits;
  const scaled = Number((Math.abs(value) * f).toPrecision(15));
  const rounded = (Math.sign(value) * Math.round(scaled)) / f;
  return rounded === 0 ? 0 : rounded;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(iso: string | Date): string {
  return `${formatTime(iso)} · ${formatDate(iso)}`;
}

export function formatShortDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Age in completed years at `at`. */
export function ageInYears(birthDateIso: string, at: Date = new Date()): number {
  const [y, m, d] = birthDateIso.split('-').map(Number);
  let age = at.getFullYear() - y;
  if (at.getMonth() + 1 < m || (at.getMonth() + 1 === m && at.getDate() < d)) age -= 1;
  return age;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Converts `DD/MM/YYYY` (Vietnamese input) to ISO `YYYY-MM-DD`. */
export function viDateToIso(value: string): string | undefined {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : undefined;
}

export function isoToViDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function createId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}
