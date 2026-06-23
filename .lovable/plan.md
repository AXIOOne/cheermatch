
## Goal

Make the existing **Scoring Queue** tab actually show each judge only the submissions they've been assigned to, and change **Assign Panels** so admin assignments are staged and committed via a **Save** button (which then makes those teams appear in each assigned judge's queue).

## Current state

- The `/judge/queue` route and sidebar item already exist (`src/pages/judge/ScoringQueue.tsx`). It returns no rows because it filters `video_submissions` by `status = 'ready'`, but submissions actually use `approved` / `assigned` / `complete`.
- `AssignPanelsDialog` writes every combobox change to the database immediately — there is no Save button and no way to review pending changes.
- A DB trigger (`set_submissions_assigned_on_judge_assignment`) already flips matching submissions from `approved` → `assigned` when a `judge_assignments` row is inserted, so once assignments save, queue visibility follows.

## Changes

### 1. `src/components/admin/AssignPanelsDialog.tsx` — stage edits + Save

- Hold pending edits in local state keyed by `division_id:section_id` → `judge_user_id | null`, seeded from existing assignments.
- The judge combobox updates local state only (no immediate DB write).
- Show a "Modified" indicator on changed rows and a footer with **Cancel** and **Save Assignments** buttons. Save is disabled when there are no pending changes.
- On Save: diff against existing assignments and run inserts / updates / deletes in one batch, then invalidate `section-assignments`, `judge-assignments`, and `judge-submissions` queries; toast success; close dialog.

### 2. `src/pages/judge/ScoringQueue.tsx` — show only assigned submissions

- Fetch the judge's `judge_assignments` rows (event_id + division_id, section-level).
- Fetch `video_submissions` for those event_ids whose team's `division_id` matches one of the judge's assignments for that event, with `status IN ('assigned','complete')` so judges can still view what they've already scored.
- Keep the existing event filter, thumbnail/card layout, and score-status badges.
- Empty state copy: "No submissions assigned to you yet."

### 3. Judge Dashboard (`src/pages/judge/Dashboard.tsx`) — minor

- No schema change; the existing "Assigned Events" count already derives from `judge_assignments`. Leave behavior as-is so it stays consistent with the new queue.

## Technical notes

- No schema or RLS changes — `judge_assignments` already has admin-write + judge-read-own policies, and the assignment→submission status trigger is in place.
- Save runs one Supabase call per diffed row inside a `Promise.all`. On any failure, show a destructive toast and keep the dialog open with state intact.
- Submission visibility for a judge is computed client-side by intersecting `judge_assignments(event_id, division_id)` with `teams.division_id` on each submission — no new RPC.

## Out of scope

- Level- or panel-scoped filtering of the queue (assignments today are section-level per division).
- Any change to the submission status workflow beyond what the existing trigger already does.
