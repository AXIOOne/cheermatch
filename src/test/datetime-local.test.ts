import { describe, it, expect } from 'vitest';
import { isoToLocalInput, localInputToIso } from '@/lib/datetime-local';

describe('event window time round-trip', () => {
  it('re-opening and saving an event keeps the same capture time', () => {
    const entered = '2026-11-04T00:00';
    const stored = localInputToIso(entered)!;
    expect(isoToLocalInput(stored)).toBe(entered);
    expect(localInputToIso(isoToLocalInput(stored))).toBe(stored);
  });

  it('blank fields stay blank', () => {
    expect(localInputToIso('')).toBeNull();
    expect(isoToLocalInput(null)).toBe('');
  });
});
