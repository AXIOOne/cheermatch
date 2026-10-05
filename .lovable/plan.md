# AccuScore request review: full page instead of pop-up

## What changes

Clicking a request in an event's AccuScore queue (New or Completed) will open a dedicated full page instead of the current pop-up dialog.

### New page: request review
- New route: `/admin/accuscore/:eventId/:requestId`.
- Header: form name + team name, status badge, and a back link to the event's queue.
- Same content as today's pop-up, laid out with more room:
  - Team details card (gym, division, coach, email, submitted time).
  - "Coach's request" — all answers grouped under their section headings.
  - "Open Scoring" button — still opens the score submission pop-up (SubmissionScoringDialog) on top of the page, so scores can be adjusted in place.
  - Decision (Honored / Denied / Duplicate), response-to-coach box, and Send Response button — unchanged behavior, still emails the coach.
- Sending a response returns you to the event's queue.

### Queue page
- Rows and the "Open" button navigate to the new page; the old dialog is removed.
- Deep-linkable: refreshing or sharing the URL opens the same request.

## Technical details
- New file `src/pages/admin/AccuScoreRequest.tsx` (logic moved from the dialog in `AccuScoreEvent.tsx`: request query with form join, decision/response mutation, send-scoresheet-email invoke, SubmissionScoringDialog).
- `src/pages/admin/AccuScoreEvent.tsx`: remove dialog state/markup, keep tables, tabs, and panels query; rows use `useNavigate`.
- `src/App.tsx`: add route `accuscore/:eventId/:requestId`.
- No database or email changes.

## Verification
- Open a request from New and Completed tabs, send a response, confirm email flow and return to queue; check Open Scoring still works from the page.
