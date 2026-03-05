export const formatMs = (v?: number): string => {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  if (v < 1) return `${v.toFixed(2)} ms`;
  return `${Math.round(v)} ms`;
}

export const formatTime = (ts?: number): string => {
  if (!ts || typeof ts !== 'number' || !isFinite(ts)) return '—';
  const d = new Date(ts);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
