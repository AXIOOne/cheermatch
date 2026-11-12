import { describe, expect, it } from 'vitest';
import { ensureScoresheetReviewLink, formatAccuscoreCutoff } from '../../supabase/functions/_shared/scoresheet-email-links';

const input = { submissionId: 'submission', coachEmail: 'coach@example.com', coachName: 'Coach', expiresAt: '2026-11-12T20:00:00Z', callerId: 'admin' };
function database(read: any, write: any) {
  const reads: any = { select: () => reads, eq: () => reads, order: () => reads, limit: () => reads, maybeSingle: async () => read };
  const writes: any = { eq: () => writes, select: () => writes, single: async () => write };
  return { from: () => ({ ...reads, insert: () => writes, update: () => writes }) };
}
describe('scoresheet coach links', () => {
  it('formats the live November 12 cutoff in the event timezone without throwing', () => {
    const text = formatAccuscoreCutoff(input.expiresAt, 'America/New_York');
    expect(text).toContain('November 12, 2026');
    expect(text).toContain('3:00 PM EST');
    expect(formatAccuscoreCutoff(null, 'America/New_York')).toBeNull();
  });
  it('uses the public portal, not an administrator preview origin', async () => {
    expect(await ensureScoresheetReviewLink(database({ data: { id: 'id', token: 'saved-token' } }, { data: { id: 'id' } }), input))
      .toBe('https://score.cheermatch.com/review/saved-token');
  });
  it('does not allow emailing a link whose insert failed', async () => {
    await expect(ensureScoresheetReviewLink(database({ data: null }, { error: new Error('Insert rejected') }), input)).rejects.toThrow('Could not save');
  });
  it('does not allow emailing a link whose refresh failed', async () => {
    await expect(ensureScoresheetReviewLink(database({ data: { id: 'id', token: 'token' } }, { error: new Error('Update rejected') }), input)).rejects.toThrow('Could not save');
  });
  it('does not treat a failed lookup as a missing link', async () => {
    await expect(ensureScoresheetReviewLink(database({ error: new Error('Lookup failed') }, { data: { id: 'id' } }), input)).rejects.toThrow('Could not verify');
  });
});