import { describe, expect, it } from 'vitest';
import { buildScoresheet } from './build-scoresheet';

const baseInput = {
  team_name: 'Team',
  gym_name: 'Gym',
  division_name: null,
  level_name: null,
  event_name: 'Event',
  accuscore_end_at: null,
  fields: [],
  show_comments: true,
  deduction_catalog: [
    { id: 'd1', name: 'Athlete Fall', points: -1, display_order: 1 },
  ],
};

const j2Score = {
  deductions: 0,
  comments: 'Execution: work on arabesque flexibility',
  judge_label: 'J2',
  panel_name: 'Execution',
  panel_abbreviation: 'J2',
  deduction_items: [],
  details: [],
};

describe('buildScoresheet safety/deduction comments', () => {
  it('leaves safety comments empty when no SD score is submitted (Notre Dame Prep case)', () => {
    const sheet = buildScoresheet({ ...baseInput, submitted_scores: [j2Score] as any });
    expect(sheet.safety_comments).toBe('');
    expect(sheet.deduction_report.total).toBe(0);
    expect(sheet.deduction_report.rows[0].occurrences).toBe(0);
  });

  it('uses the SD panel score for safety comments and deductions when present', () => {
    const sdScore = {
      deductions: 2,
      comments: 'Two athlete falls in pyramid',
      judge_label: 'SD',
      panel_name: 'Safety & Deductions',
      panel_abbreviation: 'SD',
      deduction_items: [{ deduction_type_id: 'd1', count: 2, warnings: 0 }],
      details: [],
    };
    const sheet = buildScoresheet({ ...baseInput, submitted_scores: [j2Score, sdScore] as any });
    expect(sheet.safety_comments).toBe('Two athlete falls in pyramid');
    expect(sheet.deduction_report.total).toBe(2);
  });

  it('still lists all judges comments separately', () => {
    const sheet = buildScoresheet({ ...baseInput, submitted_scores: [j2Score] as any });
    expect(sheet.judge_comments).toEqual([
      { judge_label: 'J2', comments: 'Execution: work on arabesque flexibility' },
    ]);
  });
});
