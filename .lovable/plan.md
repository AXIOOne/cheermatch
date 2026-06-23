
# Mobile Coach App — Plan

Build a mobile-first coach experience inside this same Lovable project (`/m/*` routes) wrapped with Capacitor for native iOS/Android. The coach logs in, picks one of their pre-linked event/team registrations, records the routine in-app, the video uploads directly to Brightcove, and a `video_submissions` row appears in the admin Submissions screen.

## User flow

```
Login (email + password)
   ↓
Home: list of Events open for submissions where this coach has a team
   ↓
Pick Event → list of THIS coach's teams in that event
   ↓
Team detail: division, level, athlete count, deadline, submission status,
            existing video (if any)
   ↓
"Record performance" → fullscreen native camera, max duration = event.duration_of_capture
            (with optional retake; uses event.screen_capture_cnt as the attempt limit)
   ↓
Preview → "Submit" → upload to Brightcove (progress bar, resilient to backgrounding)
   ↓
Backend writes video_submissions row (status='submitted', video URL,
            Brightcove video_id, duration, captured_at, device info)
   ↓
Confirmation screen → row appears in admin /admin/events/:id/submissions
```

## Architecture

### Routes (new, all under `/m`)

| Route | Screen |
|---|---|
| `/m/login` | Email + password (mobile-styled) |
| `/m/forgot-password` | Request reset code |
| `/m/reset-password` | Enter code + new password |
| `/m` | Event list (coach's events with open submissions) |
| `/m/events/:eventId` | Team list for this coach in that event |
| `/m/teams/:teamId` | Team detail + Record CTA |
| `/m/teams/:teamId/record` | Capacitor camera capture |
| `/m/teams/:teamId/review` | Preview + submit/retake |
| `/m/teams/:teamId/uploading` | Upload progress + success |

New `MobileLayout` (no admin sidebar; bottom-safe-area aware, dark teal header). Mobile auth uses a separate `useMobileAuth` hook that stores the legacy session token in `localStorage` / Capacitor `Preferences` — completely independent of the web portal's Supabase auth so a coach signing in on mobile doesn't touch the admin session and vice versa.

### Backend (edge functions, all returning the legacy `{status,message,data}` envelope already established in Phase 1)

| Function | Purpose |
|---|---|
| `login` | Email+password → mints a `mobile_sessions` token, returns coach profile |
| `signup` | Self-serve coach signup (creates auth user + profile + gym_coach role + password_hash) |
| `forgotPassword` | Emails a 6-digit reset code via Resend |
| `create_password` | Consumes the reset code, sets new password |
| `mobile-coach-events` | Lists events that have at least one team owned by this coach AND are open for submissions |
| `mobile-coach-teams` | Lists this coach's teams for a given event (with submission status + video) |
| `brightcove-upload-init` | Asks Brightcove for a `video_id` + signed upload URL (Dynamic Ingest API). Returns those + the ingest callback URL. |
| `brightcove-upload-complete` | Called by the app after the bytes are uploaded. Tells Brightcove to ingest, then creates/updates `video_submissions` with the Brightcove `video_id`, master URL, duration, captured_at. Sets status `submitted`. |
| `brightcove-ingest-callback` | Public webhook Brightcove calls when transcoding finishes → flips submission to `ready` and stores the playback URL/thumbnail. |

Each authenticated function calls `legacyAuth(req)` from `_shared/legacy.ts` and resolves the coach. The Brightcove functions use the OAuth client-credentials flow (cached access token in memory per cold start).

### Brightcove integration

Secrets needed (I'll request them in build mode):
- `BRIGHTCOVE_ACCOUNT_ID`
- `BRIGHTCOVE_CLIENT_ID`
- `BRIGHTCOVE_CLIENT_SECRET`
- `BRIGHTCOVE_INGEST_CALLBACK_SECRET` (generated, shared secret on the callback URL)

Flow (Brightcove Dynamic Ingest API):

```
brightcove-upload-init
  1. POST https://oauth.brightcove.com/v4/access_token (client credentials)
  2. POST .../v1/accounts/{acct}/videos                → video_id, master upload URL
  3. GET  .../v1/accounts/{acct}/videos/{video_id}/upload-urls/{filename}
                                                        → signed S3 PUT URL
  4. Return { video_id, signed_url, api_url } to app
mobile app
  5. PUT bytes to signed_url with progress (XHR or fetch with stream)
brightcove-upload-complete
  6. POST .../v1/accounts/{acct}/videos/{video_id}/ingest-requests
       { master: { url: api_url }, callbacks: [callback_url] }
  7. INSERT/UPDATE video_submissions
       (team_id, event_id, video_provider='brightcove',
        provider_video_id, status='submitted', captured_at, duration_seconds, device_info)
brightcove-ingest-callback
  8. Verifies shared secret, looks up submission by provider_video_id,
     updates playback_url, thumbnail_url, status='ready'.
```

### Database additions (one migration)

- Add columns to `video_submissions`:
  - `video_provider text default 'brightcove'`
  - `provider_video_id text` (Brightcove ID)
  - `playback_url text`, `thumbnail_url text`
  - `duration_seconds integer`
  - `captured_at timestamptz`
  - `device_info jsonb`
  - `submitted_via text default 'web'` (set to `mobile` from this flow)
- Index `video_submissions(provider_video_id)`
- Index `teams(coach_user_id, event_id)` via the existing FK chain

(Verify before writing — some of these may already exist; the migration uses `IF NOT EXISTS`.)

### Capacitor setup

- Install: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/preferences`, `@capacitor/network`, `@capacitor-community/media` (for long video recording — `@capacitor/camera` alone caps short clips).
- `capacitor.config.ts` with `appId: app.lovable.2c3cf65aff5b451a87e1f8f6c14f9f5c`, `appName: cheermatch`, hot-reload server URL pointing at the Lovable preview.
- Web fallback: in a regular browser the record screen uses `MediaRecorder` so the flow still works for testing in the preview pane.

## Admin portal impact

Almost none. The existing admin `/admin/events/:id/submissions` and review pages already render `video_submissions` rows; the new ones just have a `submitted_via='mobile'` and a Brightcove URL. I'll add a small "Mobile" badge on those rows so admins can tell at a glance.

## What I'm NOT changing

- Web portal auth, judging flow, scoring screens, results, email templates.
- Existing Phase 1 endpoints already shipped (`competitionList`, `getMobileAppVersion`, `getDropboxSetting`, `uniqueTeamName`).
- The `_shared/legacy.ts` helper or its envelope.

## Phasing

I'll ship this in one approval but in clearly separated commits so it's reviewable:

1. **Migration** — add the new `video_submissions` columns + Brightcove secrets request.
2. **Auth edge functions** — `login`, `signup`, `forgotPassword`, `create_password` (no Brightcove dep, can be tested immediately).
3. **Mobile React shell** — `/m/login`, `/m`, `/m/events/:id`, `/m/teams/:id`, `useMobileAuth` hook, `MobileLayout`. Talks to the auth functions only; record/upload buttons stubbed.
4. **Brightcove edge functions** — `brightcove-upload-init`, `brightcove-upload-complete`, `brightcove-ingest-callback`. Tested via curl against a real Brightcove account.
5. **Record + upload UI** — Capacitor + MediaRecorder fallback, progress bar, retake logic.
6. **Capacitor wiring** — `capacitor.config.ts`, install native plugins, instructions for `npx cap add ios/android` and shipping to TestFlight.

After Phase 6 you'll be able to: install the app on an iPhone (via Xcode/TestFlight), log in as a coach, pick a team, record, upload, and see the submission land in `/admin/events/:id/submissions` with playback.

## Secrets I'll need (in build mode)

- `BRIGHTCOVE_ACCOUNT_ID` (from Brightcove Studio → Admin → Account Information)
- `BRIGHTCOVE_CLIENT_ID` (from Studio → Admin → API Authentication → your client)
- `BRIGHTCOVE_CLIENT_SECRET` (same place)
- I'll auto-generate `BRIGHTCOVE_INGEST_CALLBACK_SECRET` (no input needed)

## Open question for after approval

The existing legacy `login.php` JSON shape — I asked for a sample last turn. If you can't easily pull one, I'll ship `login` with this default response shape and we can rename fields later:

```json
{"status":true,"message":"Login successful","data":{
  "id":"<uuid>","email":"...","full_name":"...","organization_name":"...",
  "role":"gym_coach","token":"<opaque>","token_expires":"<iso>"}}
```

Tell me if that's fine, or paste a sample login.php response and I'll match it exactly.
