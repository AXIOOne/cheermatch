# Division Averages Report

Add a fourth report, **Averages**, to the event Results page's ranking reports. It shows every team in a division as a row and every scoring criterion as a column, with the judge-averaged Difficulty and Execution values in one cell.

## Layout

```text
Division Averages Report
<Event Name>                                        L1 Junior - Small

Team Name              Stunt        PYR         Tumbling     Dance
World Cup Onyx         4.50 | 3.50  3.70 | 3.70  0.50 | --   0.90 | 0.80
A-List Shimmer         4.50 | 3.70  3.80 | 3.70  0.50 | --   1.00 | 0.90
...
Inspire Supreme        4.50 | 3.90  4.00 | 3.80  0.50 | --   1.00 | 0.80   <- 1st place
```

- One row per team, one column per criterion. No rank, raw, deduction, or event-score columns (criteria only, per the sample).
- Cell format `D | E`, two decimals; a missing side renders as `--`. Criteria with only one score type still use the two-slot format.
- Rows are ordered by ranking with **first place at the bottom** (worst at top).
- Criteria are grouped by name exactly the way the scoresheet already does, so a difficulty field and an execution field sharing a criterion name collapse into one column.

## Column headers

Scoring fields have no abbreviation of their own in the template, so the header uses the criterion name, shortened for fit: the section abbreviation is used as a prefix only when two criteria in different sections share the same name. Long names wrap onto a second header line.

## On screen

- The report selector on Results gains an **Averages** option alongside Overall / By Level / By Division.
- Averages is division-scoped: the division filter applies, defaulting to all divisions rendered as stacked tables (one heading + table per division).
- Wide tables scroll horizontally on screen.

## PDF export

- **Export PDF** produces one page per division, in the same division order as the screen.
- Landscape Letter to fit the criteria columns; if a division has more criteria than fit, columns continue on a continuation page for that division with the team-name column repeated.
- Header matches the existing rankings PDFs: bold "Division Averages Report" title, rule, event name centered with the date range at right, then the division name; footer with the event name and "Generated: <date time>" on every page.

## Technical notes

- New `src/lib/build-averages.ts`: reuses the fetch already in `src/lib/build-rankings.ts` (submissions, submitted scores, score details, admin overrides, template resolution) but keeps per-field difficulty/execution averages instead of collapsing to a total. To avoid a second round trip, the shared fetch is factored out of `fetchEventRankingRows` so both builders consume the same query result; ranking values still come from `buildScoresheet` so ordering matches the existing standings exactly.
- Column set is computed per division from the template(s) in play for that division's teams; if teams in one division resolve to different templates, the union of criteria is used and missing cells show `--`.
- New `src/lib/averages-pdf.ts`: pdf-lib generator following `src/lib/rankings-pdf.ts` conventions (Times/Helvetica bold headers, shared wrap/measure helpers), landscape page size.
- `src/pages/admin/EventResults.tsx` gains the Averages mode, table rendering, and export wiring.
- No schema changes.
