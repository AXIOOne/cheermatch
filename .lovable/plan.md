## Deduction Report on Final Page of Scoresheet PDF

Add a deduction summary table to the last page of the PDF scoresheet, listing every deduction type from the scoring template with columns for Value, # Occurrences, # Warnings, and Score. Then add a single "Safety & Deduction Comments" box below it.

### Visual layout (final page)

```text
+----------------------- Page header -------------------------+
| Judge Comments (only if enabled — existing behavior)        |
|   [judge comment boxes per panel, as today]                 |
+-------------------------------------------------------------+
| Deduction Report                                            |
| +--------------------+-------+-------------+----------+-----+
| | Deduction Name     | Value | Occurrences | Warnings |Score|
| +--------------------+-------+-------------+----------+-----+
| | Athlete Fall       | 0.15  |     0       |    0     | 0.00|
| | ... every deduction_type from the template, in order ...  |
| +--------------------+-------+-------------+----------+-----+
|                                            Total: | 0.00    |
+-------------------------------------------------------------+
| Safety & Deduction Comments                                 |
| +---------------------------------------------------------+ |
| | [free text from the safety/deduction judge]             | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

The report appears on its own page (a new last page) after the existing scores page and any judge-comments pages. If it doesn't fit, it paginates.

### Data rules

- The deductions table renders every `deduction_type` defined on the team's scoring template, in `display_order`, even when the count is zero — matching the sample.
- **# Occurrences:** count entered by the designated safety/deduction judge (see "Designated judge" below). If no judge has recorded that deduction, show 0.
- **# Warnings:** new field captured per deduction (also recorded by the safety/deduction judge). Defaults to 0 if not present.
- **Value:** the deduction's `points` (absolute value, two decimals).
- **Score:** `value × occurrences` (two decimals, shown as a positive number to match the sample). The bottom-right total cell sums the Score column.
- **Safety & Deduction Comments:** the `comments` string from the safety/deduction judge's score row. Empty box if none.

### Designated judge

Only one judge per team should record deductions and warnings. We'll treat the judge whose panel `abbreviation` is `SD` (or panel `name` matching "Safety" / "Deductions" case-insensitively) as the designated safety/deduction judge. Their `score_deductions` rows feed Occurrences/Warnings, and their `comments` feed the comments box. If no SD panel exists for the event, fall back to the first submitted score so the report still renders.

(No UI is changed for restricting who *can* enter deductions in this plan — let me know if you also want the judge UI gated so only the SD panel sees the deductions section.)

### Technical changes

**1. Database migration — add warnings to `score_deductions`**

- `ALTER TABLE public.score_deductions ADD COLUMN warnings integer NOT NULL DEFAULT 0`.
- No new RLS policies needed (existing 3 policies on `score_deductions` continue to apply).
- Re-uses existing GRANTs.

**2. Judge scoring UI (`src/pages/judge/ScorePerformance.tsx` and `src/components/admin/SubmissionScoringDialog.tsx`)**

- Add a second numeric input ("Warnings") next to the existing "Count" input for each deduction row.
- Load/save the new `warnings` field alongside `count` in `score_deductions`.
- Warnings do not affect score totals — they're informational on the scoresheet only.

**3. Shared scoresheet data layer (`src/lib/build-scoresheet.ts` + `supabase/functions/_shared/build-scoresheet.ts`)**

- Extend `ScoresheetInput` with `deduction_catalog: { id, name, points, display_order }[]` and per-submitted-score `deduction_items: { deduction_type_id, count, warnings }[]` plus `panel_abbreviation`/`panel_name`.
- Extend `ScoresheetData` with `deduction_report: { rows: { name, value, occurrences, warnings, score }[]; total: number }` and `safety_comments: string`.
- `buildScoresheet` picks the SD judge (panel match, else first), maps catalog → report rows, computes total.

**4. Loader (`src/lib/download-submission-scoresheet.ts`)**

- Fetch the template's `deduction_types` (catalog) once via the existing `template_id`.
- Include `deduction_items:score_deductions(deduction_type_id, count, warnings)` and `panel:judge_panels(name, abbreviation)` on the scores query (panel is already selected today).
- Pass both into `buildScoresheet`.

**5. Edge function loader (`supabase/functions/send-scoresheet-email/index.ts`)**

- Mirror the same fetches and pass through to the shared `buildScoresheet`.

**6. PDF rendering (`src/lib/scoresheet-pdf.ts` + `supabase/functions/_shared/scoresheet-pdf.ts`)**

- After judge comments rendering completes, start a new page via `drawPageHeader` and draw:
  - Heading "Deduction Report" + rule.
  - 5-column table (Deduction Name | Value | # Occurrences | # Warnings | Score) with column widths summing to `CONTENT_W`. Header row in bold; one row per catalog entry; auto wrap long names with `wrapText`; paginate to additional pages with footer + header reused.
  - Final right-aligned Total cell under the Score column.
  - A "Safety & Deduction Comments" heading, then a bordered box containing the comments text (italic "No comments provided." in muted gray when empty).

Both files (`src/lib/...` and `supabase/functions/_shared/...`) stay in sync — same logic, mirrored.

### QA

After the edits, generate a sample PDF for an event/team that has a template with several deduction types, render with `pdftoppm`, and visually verify: deduction table renders on its own page, all rows fit, total adds up, comments box appears below, header/footer ("VIRTUAL") still on every page.
