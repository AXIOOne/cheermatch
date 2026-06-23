## Goal

Fix three things in the admin Score Submission dialog (the screen launched from the Scoring Control Panel):

1. Make sure scores submitted by a judge always show up and are editable by an admin.
2. Rename the two bottom action buttons and change what the second one does.
3. Hide the Deductions section everywhere except the Safety & Deductions (SD) panel.

---

## 1. Reliable Judge → Admin connection + admin override

**Symptoms observed:** judges submit scores from their login (e.g. B1 panel has a submitted score in the DB right now), but in the admin dialog the controls are disabled — the dialog requires a `judge_assignments` row for the currently-selected panel before it lets an admin save anything, and uses that judge's id when inserting a new score. Panels with no assigned judge (e.g. SD on this event) can never receive an admin-entered score, and existing judge scores are read-only to the admin in practice.

**Changes in `src/components/admin/SubmissionScoringDialog.tsx`:**

- Stop gating the Save buttons on `assignedJudge`. Admins can always enter or edit a score for any panel.
- When saving:
  - If a score row already exists for the panel (whether it was created by the judge or the admin), **update it in place**. Do not change `judge_user_id` on update — preserve the original author.
  - If no score row exists yet, insert one with `judge_user_id = assignedJudge?.judge_user_id ?? current admin user id` so the NOT NULL constraint is satisfied and admin-entered scores attribute to the admin when no judge is assigned.
- Keep the "No judge assigned" notice as informational only (not blocking).
- Keep the existing `resolveScorePanelId` fallback so older rows without `panel_id` still match the right panel cell in the grid.

No schema or RLS change needed — `Admins can manage all scores` already permits full read/write.

## 2. Rename the bottom action buttons

Current bottom-of-form buttons:

```text
[ Save Draft ]   [ Submit Score ]
```

New buttons (still in `SubmissionScoringDialog.tsx`):

```text
[ Save Score ]   [ Save & Mark as Reviewed ]
```

Behavior:

- **Save Score** (left, outline) — saves all field scores, deductions, comments, and the Flag-for-review switch with `status = 'submitted'`. Does not touch `reviewed_at` / `reviewed_by`. Grid cell shows the existing green "submitted" state.
- **Save & Mark as Reviewed** (right, primary/green) — performs the same save as above, then sets `reviewed_at = now()` and `reviewed_by = current admin user id` in the same flow. Grid cell flips to the reviewed state (green with the check icon already used by the status legend).
- Re-use the existing `reviewMutation` logic by calling it right after the save succeeds, or fold the `reviewed_at` / `reviewed_by` update into the same `scores.update` call to keep it one round-trip.
- Remove the now-redundant standalone "Mark as Reviewed / Unmark Reviewed" panel that currently sits below the buttons (lines ~634–660). Keep the same control in the dialog header (top-right) for quickly toggling the reviewed flag without re-saving the whole form.
- The Scoring Control Panel grid already invalidates on success, so the cell colors and the "reviewed" check icon update automatically.

> Note on the word "revised": the existing status legend uses **"reviewed"** with the green check, so this plan treats "Save & Mark as Reviewed" as that same status. If you actually want a brand-new "revised" status distinct from "reviewed", say the word and I'll add a separate flag and legend entry.

## 3. Deductions visible only on the SD panel

In `SubmissionScoringDialog.tsx`:

- Compute `isSdPanel = selectedPanelAbbrev?.toUpperCase() === 'SD'`.
- Hide the entire Deductions block (label, per-type inputs, "Total deductions" row) when `!isSdPanel`.
- In `calculateTotalScore`, only subtract `deductionsTotal` when `isSdPanel`; otherwise total is just the sum of the panel's field points.
- On save, only write `score_deductions` rows and the `deductions` column when `isSdPanel`. For non-SD panels, clear any deductions on that panel's score row so old data can't linger.

No change to `deduction_types` or `score_deductions` schema.

---

## Technical notes (for the implementer)

- Files touched: only `src/components/admin/SubmissionScoringDialog.tsx`.
- No migration required. `scores.judge_user_id` stays NOT NULL; admin id is used as a fallback only on insert.
- React Query keys to invalidate after save: `['submission-all-scores', submissionId]` and `['event-submissions-scoring', eventId]` (already wired).
- The judge-side scoring page (`src/pages/judge/ScorePerformance.tsx`) already writes `panel_id`, so the grid and dialog will continue to resolve panels correctly for new judge submissions.

## Out of scope

- No changes to judge-side scoring UI.
- No changes to scoring templates, panels, or judge-assignment management.
- No new status values (unless you confirm "revised" should be separate from "reviewed").