import { describe, it, expect } from 'vitest';
import { divisionReportRecipients } from '../../supabase/functions/_shared/division-report-recipients';

describe('divisionReportRecipients', () => {
  it('sends one email per coach even with several teams in the division', () => {
    const r = divisionReportRecipients([
      { coach_email: 'Coach@School.org' }, { coach_email: 'coach@school.org' }, { coach_email: 'other@school.org' },
    ]);
    expect(r.map(x => x.email)).toEqual(['Coach@School.org', 'other@school.org']);
  });
  it('skips teams without a valid coach email', () => {
    expect(divisionReportRecipients([{ coach_email: '' }, { coach_email: 'bad' }])).toEqual([]);
  });
});
