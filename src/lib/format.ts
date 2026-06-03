const EM_DASH = '—';

function isNullish(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

/** Format a 0-1 ratio as a percent string with sign. Null/NaN becomes em-dash. */
export function fmtPct(value: number | null | undefined, decimals = 2): string {
  if (isNullish(value)) return EM_DASH;
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a number with fixed decimals. Null/NaN becomes em-dash. */
export function fmtNum(value: number | null | undefined, decimals = 2): string {
  if (isNullish(value)) return EM_DASH;
  return value.toFixed(decimals);
}

/** Format a Date or ISO-ish string as `YYYY-MM-DD` in UTC. */
export function fmtDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return EM_DASH;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a number compactly, e.g. 1_200_000 -> "1.2M". Null/NaN becomes em-dash. */
export function fmtCompact(value: number | null | undefined): string {
  if (isNullish(value)) return EM_DASH;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}
