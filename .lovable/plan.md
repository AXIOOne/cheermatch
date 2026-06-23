## Gap analysis vs the workflow spec

I compared each section of your spec against the current implementation. Below is what already works, what's missing, and what I'll change. Per your answers: keep the existing 7-value `event_status` enum and gate phases with date/time windows; admins handle reviewer duties (no new role).

### What already exists today
- Admin event CRUD, draft/registration_open/registration_closed/open_for_scoring/in_progress/completed/archived statuses.
- Manual team registration via Add Registration on `EventRegistrations`.
- Mobile coach login + scoped event/team listing (coach only sees their own).
- Submission capture (with capture duration + attempts + landscape capture from the recent changes).
- Submission review screen with approve / deny actions; trigger auto-promotes approved submissions to `assigned` when judges are assigned, and to `complete` on event close.
- Judge assignments, scoring templates, scoring queue, scores, scoresheet email.

### Gaps to close

1. **CSV bulk team registration** — missing entirely. (#1 in spec)
2. **Coach account verification** — `teams.coach_email` is captured but no check that an `auth.users` profile + `gym_coach` role exists; no inline "invite coach" action from the registrations screen; no "teams blocked until coach active" indicator. (#2)
3. **Explicit submission & scoring windows** — only `sub_deadline` (single date) exists. Spec needs an open *and* close for submissions and for scoring, independent of `event.status`. The Mobile Capture App currently lets a coach record any time the event row is visible. (#3, #5)
4. **Review path is binary** — UI supports approve / deny but spec also requires "Returned for revision" with feedback comments visible to the coach in the mobile app. No `revision_requested` status, no `review_notes` field on `video_submissions`, no coach-side display. (#4)
5. **Mobile coach feedback visibility** — coach has no view of approval status / reviewer comments / revision requests for their submissions. (#4)
6. **Status flow signage** — Admin Events list does not show submission/scoring window state as separate chips, only the enum.

---

## Plan

### Phase 1 — Data model (one migration)
- `events`: add `submission_open_at timestamptz`, `submission_close_at timestamptz`, `scoring_open_at timestamptz`, `scoring_close_at timestamptz`, `registration_open_at timestamptz`, `registration_close_at timestamptz`. Keep `sub_deadline` for back-compat; populate `submission_close_at` from it on first save.
- `video_submissions`: add `review_notes text`, `reviewed_at timestamptz`, `reviewed_by uuid references auth.users(id)`.
- Extend `submission_status` enum with `revision_requested`.
- New helper view / RPC `coach_account_status(team_id)` returning `{ has_profile, has_role, invite_sent_at }` so the registrations table can render a status pill without N+1 calls.

### Phase 2 — Admin: Event editor windows
- In `src/pages/admin/Events.tsx`, add a "Windows" section to the create/edit dialog with the four datetime pairs (registration, submission, scoring). Validate that close > open and that submission_open ≥ registration_close.
- Show window state chips ("Submissions open", "Scoring open", "Closed") on the Events list and Dashboard.

### Phase 3 — CSV team import
- Add an "Import CSV" button next to "Add Registration" on `EventRegistrations.tsx`.
- New `BulkImportTeamsDialog`: accepts CSV with columns `team_name, gym_name, division, level, athlete_count, athletes_male, athletes_female, coach_name, coach_email, coach_phone`. Preview table with per-row validation (unknown division/level, duplicate team name, missing coach email). Commit inserts in a single batch and reports a summary.
- Reuse existing `uniqueTeamName` edge function for the duplicate check.

### Phase 4 — Coach verification
- New edge function `verify-coach-accounts` (admin-only): for an event, returns the list of distinct `coach_email`s with `{ user_exists, has_gym_coach_role, last_invite_sent_at }`.
- On `EventRegistrations.tsx`, add a "Coach status" column (Active / Invite pending / Not invited) and a per-row "Invite coach" action that calls existing `resend-user-invite` (extending it to create the user + role if missing). Header banner: "X of Y coaches not yet active" with a "Invite all missing" bulk action.
- Submission gating: in `MobileTeamDetail`/`MobileRecord`, hide "Record" when `event.submission_open_at > now()` or `submission_close_at < now()`, and surface the reason.

### Phase 5 — Submission review with revision path
- In `src/pages/admin/Submissions.tsx` (and `SubmissionScoresheet.tsx`), add a third action "Request revision" that opens a dialog for `review_notes`, sets status to `revision_requested`, stamps `reviewed_at` / `reviewed_by`, and emails the coach via a new `send-revision-request` edge function (reuses the email template system).
- Approve / Deny actions also write `review_notes`, `reviewed_at`, `reviewed_by`.
- Mobile: on `MobileTeamDetail`, render a status banner per submission — Pending review / Approved / Denied / Revision requested + reviewer notes. When `revision_requested`, re-enable the Record button (still bounded by the event's `screen_capture_cnt` total).

### Phase 6 — Scoring window enforcement
- `ScoringQueue` / `ScorePerformance`: guard against `event.scoring_open_at > now()` or `scoring_close_at < now()`; show a "Scoring not open" state. Judges still see assignments but cannot submit scores outside the window.

### Out of scope (per your answers)
- No new Reviewer role; admins keep doing reviews.
- No changes to the `event_status` enum itself.

---

## Technical notes

- Migration order: extend enum first, then alter tables, then add view/RPC. Existing trigger `set_submissions_complete_on_event_close` is unaffected. `revision_requested` is not added to `LIFECYCLE_STATUSES` to keep the kanban-style stats, but a separate "Revisions" stat card is added.
- `resend-user-invite` will be extended (not replaced) to: (a) create `auth.users` + `profiles` row if missing, (b) ensure `user_roles(role='gym_coach')`, (c) send invite email. Idempotent.
- Mobile gating is enforced both client-side (UI) and server-side in the existing `mobile-coach-events` / `mobile-coach-teams` edge functions by filtering by `submission_open_at ≤ now() ≤ submission_close_at`.
- CSV parsing handled client-side with PapaParse (`bun add papaparse`).
- All new public-schema objects get the standard GRANT + RLS pattern; no anon grants needed.

### Files touched
- New migration (events columns, video_submissions columns, enum value, helper RPC).
- New: `src/components/admin/BulkImportTeamsDialog.tsx`, `src/components/admin/RequestRevisionDialog.tsx`, `supabase/functions/verify-coach-accounts/`, `supabase/functions/send-revision-request/`.
- Edited: `src/pages/admin/Events.tsx`, `src/pages/admin/EventRegistrations.tsx`, `src/pages/admin/Submissions.tsx`, `src/pages/admin/SubmissionScoresheet.tsx`, `src/pages/admin/Dashboard.tsx`, `src/pages/mobile/MobileTeamDetail.tsx`, `src/pages/mobile/MobileRecord.tsx`, `src/pages/judge/ScoringQueue.tsx`, `src/pages/judge/ScorePerformance.tsx`, `supabase/functions/mobile-coach-events/index.ts`, `supabase/functions/mobile-coach-teams/index.ts`, `supabase/functions/resend-user-invite/index.ts`.
