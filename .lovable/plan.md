## What's actually broken

I checked the data for this event. The Scoring Control Panel grid is **panel-keyed** — every cell in the grid is matched to a score by `score.panel_id`. But on this event, **all 5 judge assignments have `panel_id = NULL`**, even though the event has 6 panels (B1, B2, T1, T2, OV, SD). So when a judge submits, the score row is written with `panel_id = NULL`, no cell in the grid ever matches it, and nothing lights up — submissions, flags, and "mark as reviewed" all look like they "aren't reflecting" even though the database is updating correctly.

The same panel-keyed lookup is used inside the admin scoring dialog, so admin-side actions also fail to render until a panel is attached.

## Fix

### 1. Require a panel on every judge assignment
- In `AssignPanelsDialog` / `JudgeAssignmentDialog` / `BulkJudgeAssignmentDialog`, when the event has panels (`judge_panels` rows > 0), make panel selection **required**. No more saving an assignment with `panel_id = NULL` on a paneled event.
- Add a small validation banner if the event has panels but any existing assignment is missing one, with a one-click "Assign panel" inline fix.

### 2. Backfill / repair existing assignments
- One-time admin action surfaced at the top of the Scoring Control Panel ("5 assignments are missing a panel — fix now") that opens the same assignment editor pre-filtered to the broken rows.
- Optional supabase migration to also backfill any existing `scores` rows for this event whose `panel_id` is null by joining to `judge_assignments` on `(event_id, judge_user_id, division_id, level_id)` and copying the panel_id over — only when exactly one matching assignment exists.

### 3. Make the grid resilient even if panel_id is missing
So one bad assignment never silently hides a real submission:
- In `EventScoring.getPanelStatus`, fall back to matching by `judge_user_id → assignment.panel_id` when `score.panel_id` is null.
- Add a "Unassigned panel" column at the right of the grid that lists any submitted scores with no resolvable panel, so admins can see them and act.

### 4. Confirm Submit / Submit & Flag / Mark as Reviewed flows end-to-end
Schema and code paths already exist:
- Judge: `Submit` writes `status='submitted', needs_review=false`. `Submit & Flag` (with reason) writes `status='submitted', needs_review=true, review_reason=…`.
- Admin grid cell colors: red = pending/in-progress, green = complete (submitted), amber = needs review, green w/ check = reviewed.
- Admin scoring dialog has a "Mark as reviewed" button writing `reviewed_at`, `reviewed_by`.

I'll verify each in the preview after the panel fix and tighten any gaps I find (e.g. surface `review_reason` text in the admin dialog header when `needs_review=true`, and show an explicit "Reviewed by X on …" line under the cell when hovered).

### 5. Overall submission status text
Already computes `PENDING / COMPLETE / REVIEWED`. After fix #1–#3 these will become accurate. I'll add a fourth state **`NEEDS REVIEW`** to the overall badge when any panel is flagged but not yet reviewed, so admins can spot flagged submissions at a glance without scanning per-panel cells.

## Out of scope
- Judging UI changes beyond what's needed for the flag flow (already built).
- Renaming statuses or restructuring the grid.
- Notifications / email when a score is flagged.

## Technical notes
- Files touched: `src/pages/admin/EventScoring.tsx`, `src/components/admin/SubmissionScoringDialog.tsx`, `src/components/admin/AssignPanelsDialog.tsx`, `src/components/admin/JudgeAssignmentDialog.tsx`, `src/components/admin/BulkJudgeAssignmentDialog.tsx`.
- One optional data-only migration to backfill `judge_assignments.panel_id` and `scores.panel_id` for this event.
- No schema changes — `needs_review`, `review_reason`, `reviewed_at`, `reviewed_by` already exist on `scores`.
