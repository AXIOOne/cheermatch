
## Goal

Give your iOS/Android developers a clean, documented HTTP API they can code against — without them needing to know anything about Supabase, Brightcove, or the web portal internals. No Capacitor wrapping, no native code from us.

## Good news: most of the surface already exists

The `/m` web app already talks to a set of edge functions built for exactly this purpose. Your developers can call the same endpoints. Nothing new to invent for the core flows:

| Capability | Endpoint | Status |
| --- | --- | --- |
| Login (email + password) | `POST /functions/v1/login` | ✅ exists — returns session token + user profile |
| Forgot password (email a 6-digit code) | `POST /functions/v1/forgotPassword` | ✅ exists |
| Reset password with code | `POST /functions/v1/create_password` | ✅ exists |
| List events assigned to coach | `POST /functions/v1/mobile-coach-events` | ✅ exists |
| List teams for an event | `POST /functions/v1/mobile-coach-teams` | ✅ exists |
| Initialize a video upload (returns Brightcove signed URL + event folder) | `POST /functions/v1/brightcove-upload-init` | ✅ exists |
| Finalize upload → create submission | `POST /functions/v1/brightcove-upload-complete` | ✅ exists |

All use the same envelope:
```json
{ "status": true, "message": "...", "data": { /* payload */ } }
```

## Small gaps to close so external devs can build cleanly

These are the missing pieces I'll add:

1. **Logout endpoint** — `POST /functions/v1/logout` — invalidates the mobile session token (currently the web app just drops it client-side; a real native app should be able to sign out server-side too).
2. **Session validation endpoint** — `POST /functions/v1/me` — takes a token, returns the current user (name, email, org, phone, role) or 401. Lets a native app on cold start decide "is my saved token still valid?" without having to re-login.
3. **Single submission lookup** — `POST /functions/v1/mobile-submission` — fetch one submission's status/thumbnail/URL by id, so the app can poll after upload without re-listing all teams.
4. **CORS + auth header consistency** — audit the eight endpoints and make sure every one:
   - accepts the token in the `Authorization: Bearer <token>` header **and** in the body (native devs strongly prefer the header),
   - returns consistent HTTP status codes (200 on success, 401 on bad/missing token, 400 on validation errors) alongside the JSON envelope,
   - has `Access-Control-Allow-Headers` covering `authorization, content-type, apikey`.
5. **Stable base URL + anon key documentation** — the developers will need:
   - Base URL: `https://<project-ref>.supabase.co/functions/v1`
   - `apikey` header value (the publishable/anon key)
   - Their token from `login` sent as `Authorization: Bearer <token>`

## Deliverable: one Markdown API reference

I'll write `docs/mobile-api.md` in the repo — a single self-contained reference your developers can read cover to cover. Sections:

- Authentication model (how the session token works, 30-day expiry, refresh via re-login)
- Base URL, required headers, envelope shape, error format
- One section per endpoint with:
  - Method + path
  - Request body (JSON schema-style table)
  - Success response example
  - Error response examples (invalid token, validation error, not found)
  - `curl` snippet
- Video upload flow diagram (init → PUT bytes to Brightcove signed URL → complete → poll `mobile-submission` for `approved`)
- Rate-limit / auth-email caveats
- Changelog section (so future changes are visible)

## What I will NOT do in this plan

- No Capacitor / native shell work.
- No SDK generation (Swift / Kotlin) — just the HTTP contract; devs can generate their own client if they want.
- No breaking changes to the existing `/m` web app — the same endpoints keep working exactly as they do today.
- No new auth mechanism (OAuth, JWT rotation, etc.) unless you ask — the existing 30-day session token model stays.

## Optional additions (say the word)

- **Push notification registration endpoint** (`POST /register-device`) for later FCM/APNs work.
- **Postman / OpenAPI (Swagger) spec** in addition to the Markdown doc, so devs get autocomplete in Postman.
- **API key per mobile app** on top of the anon key, if you want to be able to revoke a specific app build's access without rotating the whole project.

## Recommended next step

Confirm and I'll (a) add the three missing endpoints, (b) normalize headers/CORS on the existing eight, and (c) write `docs/mobile-api.md`. If you want Postman/OpenAPI too, tell me now and I'll include it.
