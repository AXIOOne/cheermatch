## Goal

Make `total_score` everywhere mean **% Perfection Score** using this formula:

```text
raw_score      = sum of all field points earned
% raw          = (raw_score / template_max_points) * 100
% perfection   = % raw - total_deductions
event_score    = % perfection   (same value)
```

Today the judge UI, admin scoring dialog, and `scores.total_score` all store **raw points minus deductions** on the raw point scale. Only the PDF scoresheet (`build-scoresheet.ts`) computes perfection correctly. This plan unifies everything on the perfection % scale.

## Changes

### 1. Judge scoring UI — `src/pages/judge/ScorePerformance.tsx`
- Compute `totalMax = sum(visibleFields.max_points)` (memoized).
- Replace `calculateTotalScore()` so it returns `% perfection`: `(rawSum / totalMax) * 100 - dedTotal`, clamped at 0.
- Add a `calculateRawScore()` helper returning the unscaled point sum.
- In the score summary card (line ~664) show both:
  - **Raw Score**: `raw / totalMax`
  - **Deductions**: `dedTotal`
  - **% Perfection (Event Score)**: `totalScore.toFixed(2)` — the value that gets saved.
- Save `total_score = perfection %` (still send `deductions` as the deduction total).

### 2. Admin scoring dialog — `src/components/admin/SubmissionScoringDialog.tsx`
- Same change: add `totalMax`, rewrite `calculateTotalScore()` to return `% perfection`.
- Update the two "Total Score" displays (lines ~747, ~792) into a small block showing Raw Score / Deductions / % Perfection.
- Update the per-judge tile preview (line ~570) to label the value as `%` (it's already perfection-scale once writes are migrated).
- Save `total_score = perfection %`.

### 3. Aggregated views — display tweaks only
These already read `scores.total_score`; once the stored value is the perfection %, the math is correct. We only relabel and adjust ranges so the UI reads right.
- `src/pages/admin/EventResults.tsx`: label average as "Avg % Perfection".
- `src/pages/admin/EventReports.tsx`: keep histogram buckets (already 0–100); rename axes/labels to "% Perfection".
- `src/pages/admin/EventScoring.tsx`: any `total_score` cell shown gets a `%` suffix and `.toFixed(2)`.
- `src/pages/judge/ScoreHistory.tsx` (line 77): show `total_score.toFixed(2) + '%'`.
- `src/pages/review/ScoreReview.tsx` (line ~232): same `%` suffix.

### 4. PDF scoresheet — no formula change
`src/lib/build-scoresheet.ts` and `supabase/functions/_shared/build-scoresheet.ts` already implement this exact formula; leave untouched.

### 5. Backfill existing rows — migration
For every existing `scores` row, recompute and overwrite `total_score`:

```text
new_total = (sum(score_details.points) / sum(scoring_fields.max_points for that template)) * 100
            - scores.deductions
```

A single SQL migration with a CTE that joins `scores → submissions → events → templates → sections → fields` to get `template_max`, plus a sum of `score_details.points` per score, then `UPDATE scores SET total_score = GREATEST(0, ...)`. No schema changes, no new grants.

### Out of scope
- No changes to how raw field points or deductions are entered or stored.
- No changes to scoresheet PDF rendering.
- No changes to aggregation logic beyond labels/formatting.

## Files touched
- `src/pages/judge/ScorePerformance.tsx`
- `src/components/admin/SubmissionScoringDialog.tsx`
- `src/pages/admin/EventResults.tsx`
- `src/pages/admin/EventReports.tsx`
- `src/pages/admin/EventScoring.tsx`
- `src/pages/judge/ScoreHistory.tsx`
- `src/pages/review/ScoreReview.tsx`
- `supabase/migrations/<new>.sql` (one-shot backfill of `scores.total_score`)
