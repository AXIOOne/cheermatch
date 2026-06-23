## Lock submitted scores from judges + add queue status filter

### 1. Judges cannot access scores after submission

**Queue (`src/pages/judge/ScoringQueue.tsx`)**
- When the judge's score `status` is `submitted` or `locked`, render the row without a clickable "View" button — replace it with a non-interactive "Submitted" indicator. The "Scored" / "Locked" badge stays.
- Pending / `in_progress` / no-score rows keep the existing "Score" / "Continue" button.

**Score page (`src/pages/judge/ScorePerformance.tsx`)**
- On load, if the existing score for this judge + submission is `submitted` or `locked`, redirect back to `/judge/queue` with a toast: "This score has already been submitted. Contact an admin to make changes."
- Treat `submitted` the same as `locked` in `isLocked` as a defense-in-depth fallback (hides Save Draft / Submit / Submit & Flag).
- Admin views (`EventScoring.tsx`, `SubmissionScoresheet.tsx`) are unchanged — admins keep full view/edit access.

**Database guard (defense in depth)** — new migration replacing the judge UPDATE policy on `public.scores` so judges can only update rows where `status = 'in_progress'`:

```sql
DROP POLICY IF EXISTS "Judges can update their own scores" ON public.scores;

CREATE POLICY "Judges can update their own in-progress scores"
ON public.scores
FOR UPDATE
TO authenticated
USING (
  judge_user_id = auth.uid()
  AND status = 'in_progress'
)
WITH CHECK (
  judge_user_id = auth.uid()
);
```

The exact existing policy name will be confirmed against `pg_policies` before the migration runs.

### 2. Status filter on the scoring queue

Add a second filter `Select` next to the existing event filter in `ScoringQueue.tsx`:

- Options: **All**, **Pending** (no score yet or `in_progress`), **Scored** (status `submitted` or `locked`).
- Default: **Pending**, so judges land on the work they still need to do.
- Filtering happens client-side over `visibleSubmissions` using the existing `getScoreStatus(submission.id)` lookup — no extra queries.
- Empty-state copy updates to match the active filter (e.g., "No scored submissions yet.").

### Files touched
- `src/pages/judge/ScoringQueue.tsx`
- `src/pages/judge/ScorePerformance.tsx`
- New migration under `supabase/migrations/` for the RLS update

### Out of scope
- No changes to admin scoring screens, flag/review flow, or score history list.
- No changes to scoring calculation, save logic, or templates.
