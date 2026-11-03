// Convert between <input type="datetime-local"> values ("YYYY-MM-DDTHH:mm",
// interpreted in the browser's local time) and stored ISO timestamps.
// Both directions MUST use local time, otherwise each edit/save shifts the
// stored time by the UTC offset.

const pad = (n: number) => String(n).padStart(2, '0');

export const localInputToIso = (v?: string | null): string | null =>
  v && v.trim() ? new Date(v).toISOString() : null;

export const isoToLocalInput = (v?: string | null): string => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
