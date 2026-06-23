
# Legacy Webservices Recreation Plan

Recreate the 21 PHP endpoints from `virtualevents.varsity.com/webservices/*.php` as Lovable Cloud edge functions. Mobile app gets repointed to the new base URL; every response keeps the legacy JSON shape so the app needs zero code changes beyond the URL.

## Approach

**1. Shared envelope and conventions**

Every endpoint returns the legacy envelope:
```json
{ "status": true, "message": "...", "data": ... }
```
- All numeric IDs serialized as strings (`"16"`, not `16`)
- Money/decimals as strings (`"0.00"`)
- Dates/times split into `*_date` + `*_time` strings
- Booleans as `"Y"/"N"` or `"0"/"1"` as the legacy used
- HTTP 200 even on logical errors; `status:false` + `message` carries the error

A shared helper `supabase/functions/_shared/legacy.ts` provides:
- `ok(message, data)` / `fail(message)` response builders with CORS
- `formatDate(d) / formatTime(d)` splitters
- `asStringId(uuid)` and numeric-string formatters
- `legacyAuth(req)` → validates the legacy session token (see auth below) and returns the Coach/Gym profile, or `null`

**2. Auth: legacy token format on top of existing Coach/Gym accounts**

The mobile app expects `login.php` to return a session token it can replay on later calls. Supabase JWTs don't match that shape, so:

- New table `public.mobile_sessions` (`token text pk`, `user_id uuid`, `created_at`, `last_seen_at`, `expires_at`)
- `login.php` validates email/password against the existing Coach/Gym profile, mints a random token, stores it, returns the legacy user payload + token
- All authenticated endpoints accept the token via a `token` query/body param (legacy convention) and resolve it through `legacy_session_lookup` (security-definer function), bypassing RLS
- `forgotPassword.php` triggers a Resend email with a reset code, `create_password.php` consumes the code

Coach/Gym password storage: today these accounts are accessed via emailed magic links and don't have a real password. The migration adds a `password_hash` column to `profiles` (bcrypt via `pgcrypto`) populated on first `signup.php` / `create_password.php` use. Existing Coach/Gym users go through `forgotPassword.php` once to set a mobile password — no impact on the web portal login.

**3. Endpoint-by-endpoint mapping**

Each function lives at `supabase/functions/<name>/index.ts` and is reachable at `/functions/v1/<name>` (mobile app uses this as its new base URL, replacing `/webservices/`).

| Endpoint                       | Method | Auth | Source tables                                    | Notes                                                                                  |
|--------------------------------|--------|------|--------------------------------------------------|----------------------------------------------------------------------------------------|
| competitionList.php            | GET    | no   | events (+ scoring_templates)                     | Already have a confirmed sample; map fields below                                      |
| getMobileAppVersion.php        | GET    | no   | platform_settings                                | Reads `mobile_min_version` / `mobile_latest_version` keys (added by migration)         |
| getDropboxSetting.php          | GET    | no   | platform_settings                                | Reads `dropbox_*` keys                                                                 |
| getContentCategories.php       | GET    | no   | new `content_categories` table                   | Need sample to confirm shape; table added in migration                                 |
| organizations.php              | GET    | no   | distinct `gym_name` from teams + new orgs table  | Need legacy sample                                                                     |
| teamlevels.php                 | GET    | no   | levels, divisions, team_levels                   | Legacy returns a flat list — confirm shape from sample                                 |
| submissionDropdownList.php     | GET    | yes  | events, divisions, levels                        | Dropdown options for the submit form                                                   |
| uniqueTeamName.php             | GET    | yes  | teams                                            | `?name=` returns availability                                                          |
| login.php                      | POST   | no   | profiles, mobile_sessions                        | Mints token                                                                            |
| signup.php                     | POST   | no   | profiles (Coach), mobile_sessions                | Creates account if email unknown; returns same shape as login                          |
| loginContentContributors.php   | POST   | no   | profiles + user_roles                            | Same as login but restricted to a `content_contributor` role (add to enum)             |
| forgotPassword.php             | POST   | no   | profiles, password_reset_codes (new)             | Sends Resend email                                                                     |
| create_password.php            | POST   | no   | profiles, password_reset_codes                   | Consumes reset code, sets bcrypt hash                                                  |
| getLeaderboard.php             | GET    | no   | scores, video_submissions, teams, events         | Respects `release_score_leaderboard` flag                                              |
| getSubmissions.php             | GET    | yes  | video_submissions, teams, events                 | Scoped to the logged-in coach's gym                                                    |
| getSubmissions_test.php        | GET    | yes  | same as above                                    | Same handler with a `test=true` filter                                                 |
| videoSubmission.php            | GET    | yes  | video_submissions                                | Detail view by id                                                                      |
| postInitialSubmission.php      | POST   | yes  | video_submissions (status `draft`)               | Reserves a submission row, returns its id for the upload step                          |
| postSubmission.php             | POST   | yes  | video_submissions (status `submitted`)           | Finalizes after upload; writes video_url                                               |
| post_submission.json           | POST   | yes  | same as postSubmission.php                       | Likely an alias kept for back-compat — delegates to the same handler                   |
| postContentVideo.php           | POST   | yes  | new `content_videos` table                       | For content contributors                                                               |

**4. Field mapping for `competitionList.php` (concrete example, confirmed against the live response)**

```
id                              -> events.id::text
description                     -> events.name
long_description                -> events.description
start_date / start_time         -> split(events.start_date)
end_date   / end_time           -> split(events.end_date)
broadcast_deadline_date/time    -> split(events.broadcast_deadline)  [add column]
competition_status              -> map events.status -> 'OPEN'|'CLOSED'|'UPCOMING'
broadcast_channel               -> events.broadcast_channel          [add column, default 'VTV']
sub_deadline                    -> events.video_submission_deadline
reg_cost                        -> to_char(events.reg_cost,'FM999.00') [add column]
sanctioned_event                -> 'Y'/'N' from events.sanctioned     [add column]
release_score_leaderboard       -> '0'/'1' from events.results_published
per_show_registrations          -> '0'                                [add column, default 0]
hide_from_leaderboard           -> '0'/'1'                            [add column]
season_id                       -> '1' constant for now (or events.season_id if added)
screen_capture_cnt              -> events.screen_capture_cnt          [add column, default 2]
duration_of_capture             -> events.capture_duration_seconds    [add column, default 180]
current_match                   -> null (placeholder)
scoresheet_template             -> scoring_templates.name via event link
hide_from_website               -> '0'/'1'                            [add column]
show_teams_and_divisions        -> '0'/'1'                            [add column]
dont_show_scoresheet            -> '0'/'1'                            [add column]
list_on_special_events_page     -> '0'/'1'                            [add column]
hide_video_from_team_gym_division -> '0'/'1'                          [add column]
event_uuid                      -> events.public_uuid                 [add column, default short_id()]
```

Every other endpoint will get the same field-by-field mapping table once you share its sample response.

## Phased rollout

I'll need a sample JSON response for each non-trivial endpoint to lock the field names. Plan execution in phases:

**Phase 1 — Foundation (one migration + one PR-worth of code)**
- Migration: `mobile_sessions`, `password_reset_codes`, `content_categories`, `content_videos` tables (with GRANT + RLS); add the new columns on `events`, `profiles.password_hash`, and the `content_contributor` role to the `app_role` enum; helper functions `legacy_session_lookup(token)` and `verify_mobile_password(email, pw)` as SECURITY DEFINER.
- Shared `_shared/legacy.ts` helpers.
- Endpoints implemented in this phase (no sample needed, shapes already known or trivial): `competitionList`, `getMobileAppVersion`, `getDropboxSetting`, `uniqueTeamName`.

**Phase 2 — Auth endpoints**
`login`, `signup`, `forgotPassword`, `create_password`, `loginContentContributors`. Needs one sample login.php response.

**Phase 3 — Submission endpoints**
`submissionDropdownList`, `getSubmissions`, `getSubmissions_test`, `videoSubmission`, `postInitialSubmission`, `postSubmission`, `post_submission.json`. Needs samples for the request bodies and response shapes.

**Phase 4 — Remaining read endpoints**
`getContentCategories`, `organizations`, `teamlevels`, `getLeaderboard`, `postContentVideo`. Needs samples.

## Technical notes (for reviewers)

- Edge functions use `verify_jwt = false` (default for Lovable-managed functions); auth is enforced in code via `legacyAuth(req)`.
- CORS: import `corsHeaders` from `npm:@supabase/supabase-js@2/cors` in every function so the mobile app (and a browser tester) can call them.
- Service-role client is used inside functions to bypass RLS once `legacyAuth` has identified the user.
- `mobile_sessions` rows expire after 30 days; a daily `pg_cron` cleanup is added in the foundation migration.
- Video uploads keep using the existing `video_submissions.video_url` + whatever storage the legacy app posts to (Brightcove/S3); `postSubmission` only records the URL the mobile app uploads to directly, matching legacy behavior.

## Out of scope

- Changing the web portal's auth flow, the Judge/Admin UI, or any existing edge function.
- Building a new mobile app or modifying the existing one (beyond repointing its base URL).
- Replacing Brightcove/S3 video hosting.

## What I need from you to start Phase 1

Just approve this plan. Phase 1 doesn't require any more samples — I can ship it from what we already have. Before Phases 2–4 I'll ask for one sample JSON response per endpoint (a single real call from the existing mobile app is enough) so the field names match exactly.
