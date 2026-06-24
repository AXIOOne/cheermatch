Clean up the Submissions area so it focuses only on importing submissions, approving/denying, and editing team details — no scoring information.

## Changes

### Submissions list (`src/pages/admin/Submissions.tsx`)
- Keep stats simple: remove "Assigned" and "Complete" stat cards and the matching status filter options. Keep Total, Imported, Approved, Revisions, Denied.
- Keep the table columns (Team, Event, Division/Level, Status, Submitted, Actions) and the bulk Send Review Links action — these are import/approval workflow tools, not scoring.

### Submission detail page (`src/pages/admin/SubmissionScoresheet.tsx`)
Strip all scoring display while keeping approve/deny/revision and edit-team controls.

Remove:
- "Download PDF" button in the action bar.
- "Aggregated Score" number in the header.
- "Per-Panel Totals" card (right column under the video).
- "Aggregated Scoresheet" section.
- "Per-Panel Detail" section.
- All score-related queries, helpers, and imports (`scores` query, `aggregateValues`, `buildScoresheet`, `buildScoresheetPdf`, `RawField`, `ScoreType`, `handleDownloadPdf`, the aggregation logic, `Trophy`/`Award`/`FileText`/`Download`/`Play` icons no longer needed).

Keep:
- Back button, Approve / Deny / Request Revision buttons.
- Team header with Edit Team dialog trigger.
- Event / Division / Level / Athlete count / Submitted date / Status badges.
- Performance Video card (now full-width since the panel totals card is gone).
- Reviewer notes banner.

### Rename
- Rename the file/component from `SubmissionScoresheet.tsx` to `SubmissionDetail.tsx` and update the import in `src/App.tsx`, since it no longer renders a scoresheet.

Scoring views remain available elsewhere (Event Scoring, Event Results, judge tools) — only the Submissions tab is cleaned up.
