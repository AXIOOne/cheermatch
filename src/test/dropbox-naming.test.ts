import { describe, it, expect } from 'vitest';
import { dropboxFileName, dropboxFolder } from '../../supabase/functions/_shared/dropbox-naming';

describe('dropbox naming', () => {
  it('includes event, gym, team and division in that order', () => {
    expect(dropboxFileName({ event: 'NCA 2026', gym: 'Cheer Athletics', team: 'Cheetahs', division: 'L1 Junior' }))
      .toBe('NCA 2026 - Cheer Athletics - Cheetahs - L1 Junior.mp4');
  });
  it('skips a missing team name without double separators', () => {
    expect(dropboxFileName({ event: 'NCA 2026', gym: 'Elite', team: '', division: 'L2' }))
      .toBe('NCA 2026 - Elite - L2.mp4');
  });
  it('strips characters Dropbox does not allow', () => {
    expect(dropboxFileName({ event: 'A/B: Event', gym: 'G?', team: 'T*', division: 'D|1' }))
      .toBe('A B Event - G - T - D 1.mp4');
  });
  it('puts files in base/event folder', () => {
    expect(dropboxFolder('/CheerMatch Videos', 'NCA 2026')).toBe('/CheerMatch Videos/NCA 2026');
  });
});
