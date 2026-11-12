// Email links must work outside the administrator's preview/session.
export const SCORESHEET_PORTAL_URL = 'https://score.cheermatch.com';

export function formatAccuscoreCutoff(cutoff: string | null, timeZone: string): string | null {
  if (!cutoff) return null;
  // dateStyle/timeStyle cannot be combined with timeZoneName in Intl.
  return new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(cutoff));
}

export async function ensureScoresheetReviewLink(db: any, input: {
  submissionId: string; coachEmail: string; coachName: string | null;
  expiresAt: string; callerId: string;
}): Promise<string> {
  const { data: existing, error: readError } = await db.from('scoring_review_tokens')
    .select('id, token').eq('submission_id', input.submissionId).eq('coach_email', input.coachEmail)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (readError) throw new Error('Could not verify the coach review link. No email was sent.');
  const token = existing?.token || crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const result = existing?.id
    ? await db.from('scoring_review_tokens').update({ expires_at: input.expiresAt }).eq('id', existing.id).select('id').single()
    : await db.from('scoring_review_tokens').insert({
        submission_id: input.submissionId, token, coach_email: input.coachEmail,
        coach_name: input.coachName, expires_at: input.expiresAt, created_by: input.callerId, status: 'pending',
      }).select('id').single();
  if (result.error || !result.data) throw new Error('Could not save the coach review link. No email was sent.');
  return `${SCORESHEET_PORTAL_URL}/review/${token}`;
}