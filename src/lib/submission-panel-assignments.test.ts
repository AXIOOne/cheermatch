import { describe, expect, it } from 'vitest';
import { assignmentsForTeam, panelAssignmentTitle } from './submission-panel-assignments';

const assignments = [
  { panel_id: 'J1', division_id: 'other', level_id: null, section_id: 'other-section', judge_user_id: 'Taylor Anderson' },
  { panel_id: 'J1', division_id: 'junior-high', level_id: null, section_id: 'overall', judge_user_id: 'Sarah Bartlett' },
];

describe('submission panel assignments', () => {
  it('uses Elliott County Junior High’s Sarah Bartlett assignment, not another division’s Taylor Anderson', () => {
    expect(assignmentsForTeam(assignments, { division_id: 'junior-high', level_id: null }).map(a => a.judge_user_id)).toEqual(['Sarah Bartlett']);
  });
  it('does not match a level-specific assignment when the team has no level', () => {
    expect(assignmentsForTeam([{ ...assignments[1], level_id: 'level-1' }], { division_id: 'junior-high', level_id: null })).toEqual([]);
  });
  it('keeps event-wide assignments but prioritizes matching division assignments', () => {
    expect(assignmentsForTeam([{ ...assignments[0], division_id: null }, assignments[1]], { division_id: 'junior-high' }).map(a => a.judge_user_id)).toEqual(['Sarah Bartlett', 'Taylor Anderson']);
  });
  it('does not invent an assigned judge for a deleted registration', () => {
    expect(assignmentsForTeam(assignments, null)).toEqual([]);
  });
  it('resolves J1 to the assigned Overall section rather than the generic Judge 1 title', () => {
    expect(panelAssignmentTitle({ id: 'J1', name: 'Judge 1', abbreviation: 'J1' }, assignmentsForTeam(assignments, { division_id: 'junior-high' }), [{ id: 'overall', name: 'Overall' }], [])).toBe('Overall');
  });
  it('resolves SD from the submission template when it has no section', () => {
    expect(panelAssignmentTitle({ id: 'SD', name: 'Generic safety', abbreviation: 'SD' }, [], [], [{ abbreviation: 'SD', name: 'Safety & Deductions' }])).toBe('Safety & Deductions');
  });
});