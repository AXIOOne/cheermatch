// Decides whether a division's panel group in the Assign Panels dialog starts
// expanded or collapsed.
//
// Rule (Josh, 2026-11-17): a division whose every assignment row has a saved
// judge is done, so it starts collapsed; anything not fully assigned and saved
// stays expanded so the admin can see the work still owed.

export interface DivisionAssignmentVisibility {
  /** Every assignment row key that must have a judge for this division. */
  rowKeys: string[];
  /** Saved (server-backed) judge user id per row key; empty/missing means unassigned. */
  savedJudges: Record<string, string>;
  /** Explicit open/closed choice the admin made in this dialog session, if any. */
  userOverride?: boolean;
}

/**
 * True only when the division has rows to assign and each one already has a
 * saved judge. A division with no rows (no template, or a template with no
 * judging sections) is never "done" — it still needs attention.
 */
export function isDivisionFullyAssigned(
  rowKeys: string[],
  savedJudges: Record<string, string>,
): boolean {
  return rowKeys.length > 0 && rowKeys.every(key => !!savedJudges[key]);
}

/**
 * Whether the division's panel group should be open. The admin's own
 * expand/collapse click wins for the rest of the dialog session; otherwise
 * fully assigned-and-saved divisions start collapsed and the rest start open.
 */
export function divisionShouldBeOpen(state: DivisionAssignmentVisibility): boolean {
  if (state.userOverride !== undefined) return state.userOverride;
  return !isDivisionFullyAssigned(state.rowKeys, state.savedJudges);
}
