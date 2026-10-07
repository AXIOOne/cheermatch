import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Team label for reports: "Gym: Team", or just "Gym" when the event doesn't use team names. */
export function formatTeamLabel(teamName?: string | null, gymName?: string | null): string {
  const t = (teamName || '').trim();
  const g = (gymName || '').trim();
  if (!t || (g && t.toLowerCase() === g.toLowerCase())) return g || 'Unnamed team';
  return g ? `${g}: ${t}` : t;
}

/** Make labels unique within a list: duplicates get "(extra)" then "#n". */
export function disambiguateLabels<T>(
  rows: T[],
  base: (r: T) => string,
  extra: (r: T) => string | null | undefined,
  set: (r: T, label: string) => void,
): void {
  const count = (labels: string[]) => labels.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map<string, number>());
  let labels = rows.map(base);
  const c1 = count(labels);
  labels = labels.map((l, i) => (c1.get(l)! > 1 && extra(rows[i]) ? `${l} (${extra(rows[i])})` : l));
  const c2 = count(labels);
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const l = labels[i];
    if (c2.get(l)! > 1) {
      const n = (seen.get(l) || 0) + 1;
      seen.set(l, n);
      set(r, n === 1 ? l : `${l} #${n}`);
    } else set(r, l);
  });
}
