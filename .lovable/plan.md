## Goal
Remove the standalone **Teams** page since teams are created during event registration and aren't a separate entity to manage.

## Changes
1. **Sidebar** (`src/components/layout/AdminSidebar.tsx`) — remove the "Teams" nav item.
2. **Router** (`src/App.tsx`) — remove the `teams` route and the `Teams` import.
3. **EventScoring** (`src/pages/admin/EventScoring.tsx`) — the team-name link currently points to `/admin/teams`. Replace with plain text (no link), since there's no destination anymore.
4. **Delete file** `src/pages/admin/Teams.tsx`.

## Out of scope
- The `teams` database table stays — it's still used by event registration, submissions, scoring, etc. We're only removing the admin UI for browsing teams as a standalone list.

Confirm and I'll implement.
