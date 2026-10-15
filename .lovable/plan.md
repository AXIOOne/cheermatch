# Score Tracking for judges

## What you'll get
- **Event setting:** a new "Score tracking" on/off switch in the event's setup screen (off by default).
- **Judge scoring screen:** when it's on, a "Score Tracking" table shows at the bottom of the page.
  - It lists every team this judge is assigned to in the current event, grouped by division (one small table for each division, with the division title as a header).
  - There's one row per team (team or gym name) and one column per scoring field in the judge's panel (for example, B1 only sees B1 fields), plus a Total column.
  - Cells show this judge's own scores only. Submitted scores are green, scores saved as a draft are yellow, and teams not scored yet show a dash.
  - The team being scored right now is highlighted. The table updates as soon as the judge saves a draft or submits, with no page reload.
  - A small key explains the colors: Submitted = green, Draft = yellow.
- Judges never see other judges' scores. Admin previews of the judge screen show the same table.
- Teams from deleted registrations or archived videos are left out, to match the queue.

## Technical details
- Migration: add `events.score_tracking_enabled boolean not null default false`. No new tables or policies are needed, because judges can already read their own scores and score_details.
- Events.tsx: add a Switch next to the AccuScore toggle and save the new value.
- New `src/components/judge/ScoreTrackingTable.tsx`, mounted at the bottom of ScorePerformance.tsx when the event flag is true. It takes the event id, the assigned panel id, and the current submission id.
  - Data sources: the judge's open assignments for the event, then the matching video_submissions (with team, division, level, template; same filters as the queue), then this judge's scores and details for those submissions (filtered by panel when a panel is assigned).
  - Columns: the scoring_fields for each division's template, filtered to the judge's panel via scoring_field_panels / section default panel. Same-named fields merge the way the scoresheet already does. Columns are worked out per division, since templates can differ.
  - Colors use semantic success/warning tokens. After save or submit, the code invalidates the react-query key so the table refreshes.
- Help: add a short "Score Tracking" note to the judge Help scoring article.
