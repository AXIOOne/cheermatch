# Event Ranking Reports

Add three ranking reports to the event **Results** page, each viewable on screen and exportable to PDF in the layout of the sample.

## The three reports

1. **Overall standings** — every scored team at the event, ranked highest to lowest.
2. **Standings by level** — same list, split into a section per level (L1, L2, ...), ranked within each level.
3. **Division standings** — a section per division, ranked within each division. This matches the uploaded sample.

## Report columns

`Rank | Team Name | Max | Raw Score | Deductions | % Perf | Event Score`

- **Team Name**: `Gym: Team` (e.g. "Inspire Athletics: Supreme").
- **Max**: total points available in the scoring template used for that team.
- **Raw Score**: average of judges' earned points (before deductions), 2 decimals.
- **Deductions**: total deductions applied, 2 decimals.
- **% Perf**: `(Raw / Max * 100) - Deductions`, 2 decimals.
- **Event Score**: same value at 4 decimals, bold — used for tie-breaking display.

No Round column, and the header uses the event name (no short code).

## Ranking rules

- Sort by Event Score descending.
- Ties share the same rank, and the next rank skips accordingly (1, 2, 3, 3, 5) — matching the sample.
- Teams with no submitted scores are excluded.

## PDF layout

Matches the sample: bold "…Standings Report" title, a rule, the event name centered with the date range on the right, a heavier rule, then per-section headings (division or level name) followed by the table. Right-aligned numeric columns, wrapped team names, and a footer with the event name and "Generated: <date time>" on every page. Sections continue across pages with repeated column headers.

## Page behavior

The Results page gets a report selector (Overall / By Level / By Division) plus a division or level filter when relevant, the on-screen ranked table, and an **Export PDF** button that replaces the currently disabled "Export Results" button. Division report export offers all divisions in one PDF (each division starting a new page) or the selected division only.

## Technical notes

- New `src/lib/build-rankings.ts`: fetches submissions, submitted scores, score details and template max points for an event; computes raw/deduction/percent per team and produces ranked sections keyed by overall, level, or division. Reuses the existing % Perfection formula and honors admin score overrides the same way the scoresheet builder does.
- New `src/lib/rankings-pdf.ts`: pdf-lib generator following the conventions already in `src/lib/scoresheet-pdf.ts` (Letter portrait, Times/Helvetica bold headers, shared wrap/measure helpers).
- `src/pages/admin/EventResults.tsx` is reworked to consume the builder and render the selected report; no schema changes are required.
