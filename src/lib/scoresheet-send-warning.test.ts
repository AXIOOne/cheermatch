import { describe, expect, it } from 'vitest';
import { getScoresheetSendWarning } from './scoresheet-send-warning';

describe('getScoresheetSendWarning', () => {
  it('warns before sending when any panel has not submitted a score', () => {
    expect(getScoresheetSendWarning({ allComplete: false, allReviewed: false })).toBe(
      'Not all panels have submitted scores. The score sheet will be incomplete, and unsubmitted criteria will contribute zero to the percentage.'
    );
  });

  it('warns before sending when all scores are submitted but reviews are incomplete', () => {
    expect(getScoresheetSendWarning({ allComplete: true, allReviewed: false })).toBe(
      'All scores are submitted, but not all panels have been marked as reviewed.'
    );
  });

  it('does not warn when every panel is submitted and reviewed', () => {
    expect(getScoresheetSendWarning({ allComplete: true, allReviewed: true })).toBeNull();
  });
});
