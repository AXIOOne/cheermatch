import { describe, expect, it } from 'vitest';
import { assertScoresheetsReviewed } from '../../supabase/functions/_shared/scoresheet-readiness';

function database(reviewed: boolean) {
  const responses: Record<string, any> = {
    events: { discipline: 'cheer' },
    judge_panels: [{ id: 'J1', abbreviation: 'J1' }, { id: 'SD', abbreviation: 'SD' }],
    judge_assignments: [],
  };
  let reads = 0;
  return { from: (table: string) => {
    let response = responses[table];
    if (table === 'video_submissions') {
      response = reads++ === 0 ? { event_id: 'event' } : [{
        id: 'one', team: { id: 'team' }, scores: [
          { panel_id: 'J1', status: 'submitted', reviewed_at: 'now' },
          { panel_id: 'SD', status: 'submitted', reviewed_at: reviewed ? 'now' : null },
        ],
      }];
    }
    const query: any = {
      select: () => query, eq: () => query, is: () => query, not: () => query,
      single: () => Promise.resolve({ data: response, error: null }),
      then: (resolve: any) => Promise.resolve({ data: response, error: null }).then(resolve),
    };
    return query;
  } };
}

describe('server-side scoresheet review enforcement', () => {
  it('rejects bulk sending when any panel has not been reviewed', async () => {
    await expect(assertScoresheetsReviewed(database(false), 'one', 'event')).rejects.toThrow('All scoresheets must be submitted and reviewed');
  });
  it('permits bulk sending after every panel is reviewed', async () => {
    await expect(assertScoresheetsReviewed(database(true), 'one', 'event')).resolves.toBeUndefined();
  });
  it('rejects sending a submission from a different event', async () => {
    await expect(assertScoresheetsReviewed(database(true), 'one', 'other-event')).rejects.toThrow('does not belong to this event');
  });
});