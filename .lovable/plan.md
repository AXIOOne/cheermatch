## Change

Promote the existing **Mark as Reviewed** action so it's visible at the top of the Score Submission dialog instead of buried at the bottom of the scoring form.

### Why
The button already exists and is wired up (writes `reviewed_at` + `reviewed_by`, invalidates the Scoring Control Panel query, so the grid cell flips to green-with-check). It just only renders far below the deductions/comments block, and only when the currently-selected panel's score is `submitted` — so admins miss it.

### What I'll do in `SubmissionScoringDialog.tsx`

1. Add a compact action bar in the dialog header row, right of the team badge:
   - When the selected panel's score is `submitted` (including `needs_review`), show a primary `Mark as Reviewed` button with a check icon.
   - When already reviewed, swap to a muted `Reviewed ✓ — Unmark` button plus the timestamp.
   - When no submitted score exists for the panel yet, show a small disabled hint "Submit a score before it can be reviewed."
2. Keep the existing in-form review block as-is (no behavior change), so the action is reachable from both spots.
3. Reuse the same `reviewMutation` already in the file — no new state, no new endpoints.
4. Grid impact: existing `queryClient.invalidateQueries(['event-submissions-scoring', eventId])` already triggers the Scoring Control Panel cell to flip color/icon on success.

### Out of scope
- No schema changes.
- No changes to judge submit/flag flow.
- No bulk "mark all reviewed" button (can add later if you want).
