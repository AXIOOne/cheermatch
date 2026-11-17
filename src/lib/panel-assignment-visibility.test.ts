import { describe, expect, it } from 'vitest';
import {
  divisionShouldBeOpen,
  isDivisionFullyAssigned,
} from './panel-assignment-visibility';

const ROWS = ['div1:sec:s1', 'div1:sec:s2', 'div1:pnl:p1'];

const COMPLETE_SAVED = {
  'div1:sec:s1': 'judge-a',
  'div1:sec:s2': 'judge-b',
  'div1:pnl:p1': 'judge-c',
};

describe('Assign Panels collapse state', () => {
  it('counts a division as fully assigned when every row has a saved judge', () => {
    expect(isDivisionFullyAssigned(ROWS, COMPLETE_SAVED)).toBe(true);
  });

  it('is not fully assigned while any row has no saved judge', () => {
    expect(
      isDivisionFullyAssigned(ROWS, { ...COMPLETE_SAVED, 'div1:sec:s2': '' }),
    ).toBe(false);
    // Row with no saved assignment row at all (staged in the dialog only).
    expect(
      isDivisionFullyAssigned(ROWS, { 'div1:sec:s1': 'judge-a', 'div1:pnl:p1': 'judge-c' }),
    ).toBe(false);
  });

  it('does not count a division with no assignment rows as fully assigned', () => {
    expect(isDivisionFullyAssigned([], {})).toBe(false);
  });

  it('starts collapsed only when every row is saved, otherwise expanded', () => {
    expect(divisionShouldBeOpen({ rowKeys: ROWS, savedJudges: COMPLETE_SAVED })).toBe(false);
    expect(
      divisionShouldBeOpen({ rowKeys: ROWS, savedJudges: { 'div1:sec:s1': 'judge-a' } }),
    ).toBe(true);
    expect(divisionShouldBeOpen({ rowKeys: [], savedJudges: {} })).toBe(true);
  });

  it('keeps the admin manual expand/collapse choice for this dialog session', () => {
    expect(
      divisionShouldBeOpen({ rowKeys: ROWS, savedJudges: COMPLETE_SAVED, userOverride: true }),
    ).toBe(true);
    expect(
      divisionShouldBeOpen({
        rowKeys: ROWS,
        savedJudges: { 'div1:sec:s1': 'judge-a' },
        userOverride: false,
      }),
    ).toBe(false);
  });
});
