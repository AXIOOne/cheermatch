## Scoresheet PDF Rework

Fix the generated scoresheet PDF so Page 1 always shows the full averaged scores table (matching the reference screenshot) and Page 2+ contains a labeled comment box for every judge panel.

### Page 1 — Scores

- Always render the **complete** averaged scores table on page 1, regardless of how many template rows exist. If the template is unusually tall, shrink row height / font size to guarantee it fits one page.
- Keep current layout: header (gym short / event name / phase, then gym/team/level-division, hall name, AccuScore end time), then the `Judge Criteria | Max Value | Difficulty | Execution | Score` table.
- Keep the in-grid summary rows (`total_max`, `Raw Score:`, `%:`) and the bottom totals breakout table (`Raw Score | Deductions | % Perfection | Event Score`) on page 1, directly under the scores table.
- Footer (SUM / event name / Generated date) on every page — unchanged.

### Page 2+ — Judge Comments

- Force a hard page break after page 1 (always start comments on page 2, even if page 1 has leftover space).
- Render one **comment box per judge panel** that submitted scores for this team (e.g., B1, B2…). Each box includes:
  - Bold header: `Judge {panel_label}` (e.g., "Judge B1")
  - Bordered rectangle containing the judge's comments text, wrapped to fit.
  - If a judge submitted no comment, render the box with italic muted placeholder: `No comments provided.`
- Stack boxes vertically with consistent spacing. If they overflow page 2, continue onto page 3+, repeating the page footer on each page.
- Remove the current behavior that hides judges with empty comments — the comments section always renders (one box per submitting judge).

### Data layer

- `build-scoresheet.ts`: `judge_comments` now includes **every** submitted score (not just non-empty ones), sorted by `judge_label` (B1, B2, …) for stable order. Empty `comments` left as empty string so the PDF can render the placeholder.
- Mirror the same change in `supabase/functions/_shared/build-scoresheet.ts` (Deno copy used by the email send).

### Files to edit

- `src/lib/build-scoresheet.ts`
- `supabase/functions/_shared/build-scoresheet.ts`
- `src/lib/scoresheet-pdf.ts` — force page break before comments; bordered box per judge; placeholder for empty; ensure scores + totals always fit on page 1.
- `supabase/functions/_shared/scoresheet-pdf.ts` — mirror so admin preview / download / emailed PDF stay identical.

### Out of scope

- No DB schema changes.
- No changes to scoring entry UI or template definition.
- No change to how `% Perfection` / `Event Score` are computed.
