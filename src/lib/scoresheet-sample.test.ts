import { describe, expect, it } from 'vitest';
import { scoresheetSampleRecipient } from '../../supabase/functions/_shared/scoresheet-sample';

describe('sample scoresheet recipient', () => {
  it('sends Josh’s sample to his requested address rather than his portal email', () => {
    expect(scoresheetSampleRecipient('jrowzee@cheerathletics.com', 'josh@cheermatch.com')).toBe('jrowzee@cheerathletics.com');
  });
  it('rejects multiple recipients and missing authenticated email', () => {
    expect(() => scoresheetSampleRecipient('coach@example.com,other@example.com', 'jrowzee@cheerathletics.com')).toThrow();
    expect(() => scoresheetSampleRecipient('jrowzee@cheerathletics.com', undefined)).toThrow();
  });
  it('keeps ordinary sends separate from sample sends', () => {
    expect(scoresheetSampleRecipient(undefined, 'jrowzee@cheerathletics.com')).toBeNull();
  });
});