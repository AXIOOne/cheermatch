## Audit result

Most of this flow is already wired up. Here's what exists today and the small gaps to close.

### Already working
- **ScoringQueue** (`src/pages/judge/ScoringQueue.tsx`) reads `judge_assignments` for the logged-in judge, keeps only events whose status is `open_for_scoring` or `in_progress`, and filters `video_submissions` to assigned divisions.
- **ScorePerformance** (`src/pages/judge/ScorePerformance.tsx`) loads the judge's `panel_id` for the event, then filters scoring fields by `scoring_field_panels.panel_abbreviation` matching the judge's panel — so judges only see/score the fields tied to their panel. Save/submit is blocked unless the event is open for scoring.
- Trigger `set_submissions_assigned_on_judge_assignment` flips approved submissions to `assigned` when an assignment is created, so they appear in the queue.

### Gaps to fix

1. **Surface the judge's panel on the queue card.** Today the queue card shows team / gym / division / level but never tells the judge which panel (e.g. B1, B2) they're scoring for that event. Add a `Panel: B1` badge on each submission card, derived from the judge's `judge_assignments.panel_id` for that event.

2. **Hide submissions that have no fields for the judge's panel.** A judge can be assigned to a division whose scoring template has zero fields tagged for their panel. Today those submissions still appear and open to an empty scoring form. Filter them out: only show a submission if at least one `scoring_fields` row in the division's template has a `scoring_field_panels` row matching the judge's panel abbreviation (or has no panel restrictions at all).

3. **Include `approved` submissions as a safety net.** Queue currently filters to `['assigned', 'complete']`. If a panel is added after the submission was approved but the trigger missed (e.g. assignment edited later), the row never moves out of `approved`. Include `approved` in the visible statuses so nothing falls through, and rely on the division/panel filter to scope it correctly.

4. **Dashboard "Assigned Events" should reflect scoring-ready state.** On `src/pages/judge/Dashboard.tsx`, tag each assignment row with whether the event is `open_for_scoring` (green "Open for scoring"), `in_progress`, or "Not yet released" — and disable the row's **Score** button when the event isn't open. Today it shows raw enum text and always links to the queue.

### Technical notes

- No schema changes. All filters use existing tables: `judge_assignments`, `judge_panels`, `scoring_field_panels`, `scoring_fields`, `scoring_sections`, `scoring_templates`, `divisions.scoring_template_id`.
- For gap #2, extend the queue query to also fetch each division's `scoring_template_id` → sections → fields → `scoring_field_panels`, then drop submissions whose template has no matching fields for the judge's panel abbreviation. Reuse the same panel-matching logic already in `ScorePerformance.visibleSections`.
- For gap #1, the queue already loads `judge_assignments` per event; just join `panel:judge_panels(abbreviation)` and render a badge.
- Files touched: `src/pages/judge/ScoringQueue.tsx`, `src/pages/judge/Dashboard.tsx`. No migration, no edge function changes.
