## Goal

Generate a polished PDF scoresheet matching the sample table layout, with a header block showing **Team Name · Division · Event Title · AccuScore End Time**, and a footer block showing **Raw Score · Deductions · % Perfection · Event Score**. Delivered via an admin "Download PDF" button and as an attachment on the coach scoresheet email.

## Header

```text
{Team Name}                             Event: {Event Title}
Division: {Division Name}               AccuScore Ends: {accuscore_end_time}
```

`accuscore_end_time` is a new per-event setting that defines when coaches can no longer submit a review on their scoresheet. Formatted as `MMM D, YYYY · h:mm A z` in the venue/local timezone (UTC formatting acceptable for v1).

## Table (matches the sample)

| Judge Criteria | Max Value | Difficulty | Execution | Score |

- One row per scoring field, ordered by section `display_order` then field `display_order`.
- Fields sharing the same `name` within a section merge into one row: Difficulty column gets the difficulty-typed value, Execution column gets the execution-typed value, Max Value is the sum of merged `max_points`, Score = difficulty + execution (blank side = 0).
- Cells with no applicable score type render as a shaded gray box.
- Multi-judge fields: cell shows the **average across submitted judges, rounded to 2 decimals**.

## Footer

```text
                                                Raw Score:   48.40
                                                Deductions:  -1.50
                                                % Perfection: 95.30
                                                Event Score:  95.30
```

- `Raw Score` = sum of all row scores (out of total_max, typically 50).
- `Deductions` = sum of submitted-judge deductions, displayed with leading minus.
- `% Perfection` = `(raw_score / total_max) * 100 - deductions`, 2 decimals.
- `Event Score` = identical value to `% Perfection` (kept as a separate labeled line per request).

## Schema change

Add to `events`:

- `accuscore_end_at timestamptz NULL` — the cutoff for coach scoresheet reviews and the value displayed in the PDF header.

Event create/edit form (`Events.tsx`) gets a corresponding datetime input. No backfill needed; existing rows stay null and PDF prints "—" when missing. (Enforcement of the cutoff in the review portal is out of scope for this turn — column + capture + display only.)

## Technical implementation

### PDF generation (pdf-lib)

- Single renderer module that runs in both Deno and the browser: `supabase/functions/_shared/scoresheet-pdf.ts` using `npm:pdf-lib@1.17`. The admin client imports the same source via a thin `src/lib/scoresheet-pdf.ts` wrapper that pulls from npm.
- Letter portrait, Helvetica/HelveticaBold, 1px borders, gray fill `rgb(0.85, 0.85, 0.85)` for N/A cells. Judge Criteria column wraps; row height grows accordingly. Auto-paginates the table header on overflow.

### Data shaping (`src/lib/scoresheet.ts` + duplicated in `_shared/build-scoresheet.ts` since Deno can't import from `src/`)

Pulls submission → team → division → template, walks `scoring_sections`/`scoring_fields` (including `score_type`), averages per-field judge scores, merges same-name rows, sums deductions, returns the normalized payload consumed by the renderer.

### Admin download

`SubmissionScoresheet.tsx` gets a "Download PDF" button: calls shaping helper with the data already loaded by React Query, generates the PDF in-browser via pdf-lib, triggers a Blob download `{Team} - {Event}.pdf`.

### Email attachment

`supabase/functions/send-scoresheet-email/index.ts`:
- Extend submission query to include `accuscore_end_at`, `division`, `score_type`, section/field `display_order`.
- Generate the PDF with the shared renderer.
- Attach to the existing Resend email (`attachments: [{ filename, content: base64Pdf }]`). Existing HTML body remains as a summary; PDF is authoritative.

## Files

- **Migration**: add `events.accuscore_end_at`
- **New**: `supabase/functions/_shared/scoresheet-pdf.ts`, `supabase/functions/_shared/build-scoresheet.ts`, `src/lib/scoresheet-pdf.ts`, `src/lib/build-scoresheet.ts`
- **Edited**: `src/pages/admin/SubmissionScoresheet.tsx`, `src/pages/admin/Events.tsx`, `supabase/functions/send-scoresheet-email/index.ts`
- **Dependency**: `bun add pdf-lib`

## Out of scope

- Enforcing `accuscore_end_at` inside the coach review portal (display-only this turn).
- Itemized deduction list, per-judge breakdown, branding/logo on the PDF.
- Timezone picker for the displayed cutoff (UTC formatting for v1).