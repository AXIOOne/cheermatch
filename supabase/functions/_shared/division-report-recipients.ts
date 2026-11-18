export interface RecipientTeam { coach_email?: string | null; profile_email?: string | null; coach_name?: string | null; profile_name?: string | null }

/** One entry per distinct coach email (case-insensitive); the profile email wins over the registration email. */
export function divisionReportRecipients(teams: RecipientTeam[]): { email: string; name: string | null }[] {
  const seen = new Map<string, { email: string; name: string | null }>();
  for (const t of teams) {
    const email = (t.profile_email || t.coach_email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const key = email.toLowerCase();
    if (!seen.has(key)) seen.set(key, { email, name: t.profile_name || t.coach_name || null });
  }
  return [...seen.values()];
}
