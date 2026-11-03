import { describe, it, expect } from 'vitest';
import { isoToLocalInput, localInputToIso } from '@/lib/datetime-local';

describe('event window times use the event time zone', () => {
  it('midnight Nov 4 Eastern is stored as 05:00 UTC', () => {
    expect(localInputToIso('2026-11-04T00:00', 'America/New_York')).toBe('2026-11-04T05:00:00.000Z');
  });

  it('summer time uses daylight offset (midnight Jul 1 Eastern = 04:00 UTC)', () => {
    expect(localInputToIso('2026-07-01T00:00', 'America/New_York')).toBe('2026-07-01T04:00:00.000Z');
  });

  it('11:59 PM Nov 8 Pacific is stored as 07:59 UTC Nov 9', () => {
    expect(localInputToIso('2026-11-08T23:59', 'America/Los_Angeles')).toBe('2026-11-09T07:59:00.000Z');
  });

  it('re-opening and saving an event keeps the same time', () => {
    const stored = localInputToIso('2026-11-04T00:00', 'America/Chicago')!;
    expect(isoToLocalInput(stored, 'America/Chicago')).toBe('2026-11-04T00:00');
  });

  it('blank fields stay blank', () => {
    expect(localInputToIso('', 'America/New_York')).toBeNull();
    expect(isoToLocalInput(null, 'America/New_York')).toBe('');
  });
});
