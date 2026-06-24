## Goal
On the PDF scoresheet, always render every criterion row defined by the event's scoring template — even before any judges have scored. Show blanks (or 0) for missing values, and always express the score as `X / max` against the template's max points.

## Problem
`generateSubmissionScoresheetBytes` (in `src/lib/download-submission-scoresheet.ts` and the matching edge-function copy under `supabase/functions/`) builds the field list from `score_details` of submitted scores only. If no judge has scored a given criterion, the field never makes it into `buildScoresheet`, so the row is missing and `total_max` is understated.

## Plan

1. **Load fields from the template, not from score_details**
   - In `src/lib/download-submission-scoresheet.ts`:
     - Resolve the scoring template for the submission: prefer `usable[0]?.template_id`; if none (no scores yet), query `scoring_templates` by `event_id = submission.event_id` (pick `is_default` first, else the only one).
     - Query `scoring_fields` joined to `scoring_sections` for that `template_id` and seed `fieldMap` from this full list. Drop the per-detail seeding loop.
   - Mirror the same change in `supabase/functions/_shared/build-scoresheet.ts`'s caller — `supabase/functions/send-scoresheet-email/index.ts` (and `_shared/scoresheet-pdf.ts` if it queries fields). I'll read those before editing to keep parity.

2. **buildScoresheet behavior for unscored rows**
   - `averagePoints` already returns `null` when no judge has entered a value. Update the row construction so:
     - `difficulty` / `execution` stay `null` (instead of `?? 0`) when the field exists but has no scores, so the PDF can render a blank cell.
     - `score` column: if both sides are `null`, leave the row score as `null`; otherwise sum what exists.
     - `total_max` keeps summing from the template max regardless of scoring state.
     - `raw_score` only adds actual averages (treat null as 0 for the running total).

3. **PDF rendering (`src/lib/scoresheet-pdf.ts` + `supabase/functions/_shared/scoresheet-pdf.ts`)**
   - When `difficulty`/`execution`/`score` is `null`, render an empty string (or `—`) instead of `0.00`.
   - Always render the max column from `row.max_value` and the overall `raw_score / total_max` summary line using `total_max` from the template.

4. **Type updates**
   - Change `ScoresheetRow.score` to `number | null` in both copies of `build-scoresheet.ts` and adjust downstream PDF code.

## Verification
- Generate a scoresheet for a submission with zero submitted scores → every template criterion appears with blank values and the correct max totals.
- Generate one with partial scoring (one panel submitted, others not) → scored rows show averages, unscored rows show blanks, totals reflect template max.
- Generate a fully scored submission → output matches today's behavior.
