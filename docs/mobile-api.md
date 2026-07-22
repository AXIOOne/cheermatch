# Cheermatch Mobile API Reference

HTTP API for building native iOS / Android coach apps against the Cheermatch portal. The same endpoints power the web-based `/m` companion.

**Base URL**

```
https://qzckpzwhkevqhwywlrkf.supabase.co/functions/v1
```

**Required headers on every request**

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `apikey` | The Supabase publishable (anon) key — provided out-of-band to your developers |
| `Authorization` | `Bearer <session_token>` (only after login) |

The `apikey` header is required by the Supabase Edge Functions gateway. It is **not** a user credential — it only identifies the project. Ship it in the app binary; it is safe to distribute.

---

## Response envelope

Every endpoint returns JSON in this shape:

```json
{
  "status": true,
  "message": "Human-readable summary",
  "data": { /* payload, or null */ }
}
```

`status: false` means the request failed. Also inspect the HTTP status code:

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `400` | Validation error (missing / bad input) |
| `401` | Missing or expired session token |
| `404` | Resource not found or not owned by caller |
| `5xx` | Server error — safe to retry with backoff |

---

## Authentication model

1. `POST /login` returns a `token` (opaque, 64 hex chars) and `token_expires` (ISO-8601, 30 days out).
2. Store the token in secure device storage (iOS Keychain / Android EncryptedSharedPreferences).
3. Send it on every subsequent request as `Authorization: Bearer <token>`.
4. On cold start, call `POST /me` to confirm the token still works. On `401`, delete the stored token and route the user to the login screen.
5. `POST /logout` invalidates the token server-side.
6. There is **no refresh flow** — when the token expires (30 days) the user must sign in again with email + password.

---

## Endpoints

### `POST /login`

Sign a coach in.

**Request**

```json
{ "email": "coach@example.com", "password": "••••••••" }
```

**Success `200`**

```json
{
  "status": true,
  "message": "Login successful",
  "data": {
    "id": "uuid",
    "email": "coach@example.com",
    "full_name": "Jane Coach",
    "organization_name": "Elite Cheer Gym",
    "phone": "555-123-4567",
    "role": "gym_coach",
    "token": "…64 hex chars…",
    "token_expires": "2026-08-21T00:00:00.000Z"
  }
}
```

**Errors**

- `Invalid email or password` — bad credentials
- `This account is not enabled for the mobile app` — user exists but lacks the `gym_coach` or `content_contributor` role

```bash
curl -X POST "$BASE/login" \
  -H "Content-Type: application/json" -H "apikey: $ANON" \
  -d '{"email":"coach@example.com","password":"secret"}'
```

---

### `POST /me`

Validate the caller's session token and return the current profile.

**Request** — no body required; token from `Authorization` header.

**Success `200`**

```json
{
  "status": true,
  "message": "Session valid",
  "data": {
    "id": "uuid",
    "email": "coach@example.com",
    "full_name": "Jane Coach",
    "organization_name": "Elite Cheer Gym",
    "phone": "555-123-4567",
    "role": "gym_coach"
  }
}
```

**Errors** — `401` with `Invalid or expired session token`.

```bash
curl -X POST "$BASE/me" \
  -H "Content-Type: application/json" -H "apikey: $ANON" \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /logout`

Invalidate the caller's session token on the server. Idempotent.

**Request** — no body required.

**Success `200`**

```json
{ "status": true, "message": "Logged out", "data": null }
```

---

### `POST /forgotPassword`

Send a 6-digit reset code by email. Always returns success (does not reveal whether the email exists).

**Request**

```json
{ "email": "coach@example.com" }
```

**Success `200`**

```json
{ "status": true, "message": "If that email exists, a reset code has been sent", "data": null }
```

---

### `POST /create_password`

Redeem the 6-digit code and set a new password.

**Request**

```json
{ "email": "coach@example.com", "code": "123456", "password": "newSecret1" }
```

**Success `200`** — `{ "status": true, "message": "Password updated", "data": null }`

**Errors** — `Invalid or expired code`, `Password does not meet requirements`.

---

### `POST /mobile-coach-events`

List every event that has at least one team owned by the authenticated coach.

**Request** — no body required.

**Success `200`**

```json
{
  "status": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "uuid",
      "description": "Spring Nationals 2026",
      "long_description": "Full event notes…",
      "start_date": "2026-04-12",
      "end_date": "2026-04-14",
      "sub_deadline": "2026-04-10",
      "competition_status": "OPEN",
      "reg_cost": "125.00",
      "event_uuid": "short-code",
      "screen_capture_cnt": "2",
      "duration_of_capture": "180",
      "broadcast_channel": "VTV",
      "registration_open_at": "2026-02-01T00:00:00Z",
      "registration_close_at": "2026-04-01T00:00:00Z",
      "submission_open_at": "2026-04-01T00:00:00Z",
      "submission_close_at": "2026-04-10T23:59:59Z",
      "scoring_open_at": null,
      "scoring_close_at": null
    }
  ]
}
```

`competition_status` values: `UPCOMING`, `OPEN`, `CLOSED`.

---

### `POST /mobile-coach-teams`

List teams the authenticated coach can submit video for, at a given event. Each team includes its current submission (or `null` if not yet submitted).

**Request**

```json
{ "event_id": "uuid" }
```

**Success `200`**

```json
{
  "status": true,
  "message": "Teams fetched successfully",
  "data": [
    {
      "team_id": "uuid",
      "team_name": "Diamonds",
      "gym_name": "Elite Cheer Gym",
      "athletes_female": "16",
      "athletes_male": "4",
      "division_id": "uuid",
      "division_name": "Small Senior",
      "level_id": "uuid",
      "level_name": "Level 5",
      "submission": {
        "id": "uuid",
        "status": "approved",
        "video_url": "https://…",
        "thumbnail_url": "https://…",
        "brightcove_video_id": "6301234567890",
        "duration_seconds": "162",
        "submitted_at": "2026-04-08T18:22:10Z",
        "captured_at": "2026-04-08T18:19:00Z",
        "submitted_via": "mobile",
        "review_notes": "",
        "reviewed_at": ""
      }
    }
  ]
}
```

`submission.status` values: `pending`, `processing`, `approved`, `assigned`, `complete`, `rejected`, `revision_requested`.

---

### Video submission flow

Uploads use Brightcove's Dynamic Ingest, so bytes go directly from the device to Brightcove — not through this API. Three steps:

```text
┌──────────────┐  1. /brightcove-upload-init      ┌──────────────┐
│  Native app  │ ───────────────────────────────▶ │  Cheermatch  │
│              │ ◀─── signed_url + api_request_url│              │
│              │                                  └──────────────┘
│              │  2. PUT bytes to signed_url          ┌────────────┐
│              │ ───────────────────────────────────▶ │ Brightcove │
│              │ ◀─── 200 OK                          │            │
│              │  3. /brightcove-upload-complete      └────────────┘
│              │ ───────────────────────────────▶ ┌──────────────┐
│              │ ◀─── submission_id               │  Cheermatch  │
└──────────────┘                                  └──────────────┘
        │  4. poll /mobile-submission until status = "approved"
        ▼
```

---

### `POST /brightcove-upload-init`

Reserve a Brightcove video shell for a team + event and get a one-time signed upload URL.

**Request**

```json
{
  "team_id": "uuid",
  "event_id": "uuid",
  "file_name": "diamonds-final.mp4"
}
```

**Success `200`**

```json
{
  "status": true,
  "message": "Upload initialized",
  "data": {
    "video_id": "6301234567890",
    "signed_url": "https://ingestion.api.brightcove.com/...",
    "api_request_url": "https://cms.api.brightcove.com/.../ingest-requests",
    "callback_url": "https://…/functions/v1/brightcove-ingest-callback?secret=…"
  }
}
```

**Step 2 — upload the bytes yourself:**

```
PUT <signed_url>
Content-Type: video/mp4
Body: raw file bytes
```

Do **not** include the `apikey` or `Authorization` headers on the PUT — it is a signed request to Brightcove, not to Cheermatch.

---

### `POST /brightcove-upload-complete`

Notify Cheermatch that the byte upload finished. This kicks off Brightcove's ingest job and creates the submission record.

**Request**

```json
{
  "team_id": "uuid",
  "event_id": "uuid",
  "video_id": "6301234567890",
  "api_request_url": "https://cms.api.brightcove.com/.../ingest-requests",
  "duration_seconds": 162,
  "captured_at": "2026-04-08T18:19:00Z",
  "device_info": { "platform": "ios", "model": "iPhone 15", "os": "17.4" }
}
```

`duration_seconds`, `captured_at`, and `device_info` are optional but recommended.

**Success `200`**

```json
{
  "status": true,
  "message": "Upload complete",
  "data": { "submission_id": "uuid", "video_id": "6301234567890" }
}
```

After this call, poll `POST /mobile-submission` every few seconds until `status` becomes `approved` (Brightcove has finished transcoding and the video is playable).

---

### `POST /mobile-submission`

Fetch a single submission by id — used to poll status after upload without re-listing every team.

**Request**

```json
{ "submission_id": "uuid" }
```

**Success `200`**

```json
{
  "status": true,
  "message": "Submission fetched",
  "data": {
    "id": "uuid",
    "event_id": "uuid",
    "team_id": "uuid",
    "team_name": "Diamonds",
    "gym_name": "Elite Cheer Gym",
    "status": "approved",
    "video_url": "https://…",
    "thumbnail_url": "https://…",
    "brightcove_video_id": "6301234567890",
    "duration_seconds": "162",
    "submitted_at": "2026-04-08T18:22:10Z",
    "captured_at": "2026-04-08T18:19:00Z",
    "submitted_via": "mobile",
    "review_notes": "",
    "reviewed_at": ""
  }
}
```

`404` is returned both when the submission does not exist and when it belongs to a different coach — clients should not distinguish the two.

---

## Rate limits and quotas

- **Auth emails** (`forgotPassword`): the Supabase Auth service limits combined signup/reset emails per hour. Bulk password-reset scripting will hit `over_email_send_rate_limit` (HTTP 429).
- **Session tokens**: no rate limit today; each login inserts a new row, and expired rows are pruned by a nightly cron.
- **Uploads**: bounded by Brightcove account quotas, not by this API.

---

## Recommended client behavior

- **Cold start**: read stored token → `POST /me`. If `401`, clear token and show login. Otherwise show the events list.
- **Token expiry**: on any `401` mid-session, drop the token and route to login.
- **Upload retry**: if step 2 (PUT to Brightcove) fails, you may call `POST /brightcove-upload-init` again to get a fresh signed URL; the previous `video_id` becomes orphaned server-side and is harmless.
- **Polling**: after `brightcove-upload-complete`, poll `/mobile-submission` at 3 s intervals with a 60 s cap; back off to 10 s intervals after that. Transcoding usually completes in under 90 s but can take several minutes for long routines.
- **Device time**: send `captured_at` in UTC ISO-8601 to avoid timezone drift.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-07-22 | Added `/logout`, `/me`, `/mobile-submission`. Documented header-based auth. Initial public reference. |
