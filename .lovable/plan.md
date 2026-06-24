## Scoresheet PDF — visual revamp + judge comments

### Part 1: Match the reference layout (page 1)

Rewrite the header + table in `src/lib/scoresheet-pdf.ts` (and mirror in `supabase/functions/_shared/scoresheet-pdf.ts`) to match the attached screenshot.

**Header (three-column band, serif/bold).**

```text
SUM                    The Summit                 Finals
Cheer Athletics-       Hall Name: West A          AccuScore End Time:
  Denver                                            05/03/2026 05:25 pm
Ice 4
L4 Junior - Medium
```

- Left: gym short code (top, bold), then team name lines (gym, team, division stacked, bold).
- Center: event name (large bold serif) with phase/round label below (e.g. "Finals" — pulled from event round if available, otherwise blank).
- Right: "Hall Name: <hall>" centered row, "AccuScore End Time:" with timestamp right-aligned.
- Switch fonts from Helvetica to **Times-Roman / Times-Bold** (`StandardFonts.TimesRoman`, `StandardFonts.TimesRomanBold`) to match the serif look in the screenshot. Title ~22pt bold, meta ~11pt.
- Thick horizontal rule under header, second thick rule under the scoring table, matching the screenshot.

**Scoring table — tighter rows.**

- Reduce row height: cellFontSize 9 → 8.5, minimum row height 22 → 16, vertical padding shrinks accordingly so single-line rows are compact like the screenshot.
- Header row height 24 → 18, bold serif, centered.
- Keep gray-fill for N/A Difficulty/Execution cells.
- Add the summary row at the bottom of the table (inside the same grid): blank criteria cell, "50.00" bold-boxed under Max Value, "Raw Score:" + value spanning Execution/Score, "%:" + perfection on the next half-row — matching screenshot footer rows.

**Totals block (separate small table below).**

Single 4-column table: Raw Score | Deductions | % Perfection | Event Score, with one data row labeled "Finals" (or the round name). Replaces the current stacked totals box.

**Page footer.**

Small italic line: `SUM         The Summit         Generated: <timestamp>` at bottom margin on every page.

### Part 2: Judge comments toggle

**Database** (`supabase/migrations/...`):
- Add `show_comments_on_scoresheet boolean not null default false` to `public.scoring_templates`.

**Admin UI** (`src/pages/admin/ScoringTemplates.tsx`):
- Add a checkbox/switch "Show judge comments on scoresheet PDF" in the template create/edit form, persisted to the new column.

**Data shaping** (`src/lib/build-scoresheet.ts` + `supabase/functions/_shared/build-scoresheet.ts`):
- Extend `ScoresheetInput` with `show_comments: boolean` and `submitted_scores[].judge_label` (e.g. "B1") + `submitted_scores[].comments: string | null`.
- Extend `ScoresheetData` with `show_comments` and `judge_comments: Array<{ judge_label: string; comments: string }>` (only non-empty entries, only when flag is true).

**Callers** (`src/lib/download-submission-scoresheet.ts`, `supabase/functions/send-scoresheet-email/index.ts`):
- Select `scoring_templates.show_comments_on_scoresheet` and `scores.comments` + the judge's panel label, pass through to the builder.

**PDF rendering** (both `scoresheet-pdf.ts` copies):
- After the totals block, if `show_comments` and `judge_comments.length`, render a new section "Judge Comments". For each judge with non-empty comments, print a small bold header (`Judge B1`, `Judge B2`, etc.) followed by the wrapped comment text. Section flows to subsequent pages as needed.

### Technical notes

- Files touched: `src/lib/scoresheet-pdf.ts`, `src/lib/build-scoresheet.ts`, `src/lib/download-submission-scoresheet.ts`, `supabase/functions/_shared/scoresheet-pdf.ts`, `supabase/functions/_shared/build-scoresheet.ts`, `supabase/functions/send-scoresheet-email/index.ts`, `src/pages/admin/ScoringTemplates.tsx`, one migration.
- The mirrored `_shared/*` files must stay byte-equivalent in logic to the `src/lib/*` versions (Deno can't import from `src/`).
- No changes to scoring entry UI — judges already capture comments via `scores.comments`.
