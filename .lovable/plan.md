## Goal
When the mobile app uploads a performance video to Brightcove, place that video into a Brightcove folder whose name matches the Event name (creating the folder on demand if it doesn't exist yet). This keeps the Brightcove media library organized by event.

## Scope
Only the mobile upload path (`brightcove-upload-init`). No UI changes. No changes to admin-side uploads or playback.

## Changes

### 1. `supabase/functions/_shared/brightcove.ts`
Add two helpers using the Brightcove CMS Folders API:

- `bcListFolders()` → `GET /v1/accounts/{ACCOUNT_ID}/folders` (paginated as needed, simple first page is sufficient since folder counts are small)
- `bcCreateFolder(name)` → `POST /v1/accounts/{ACCOUNT_ID}/folders` body `{ name }`
- `bcAddVideoToFolder(folderId, videoId)` → `PUT /v1/accounts/{ACCOUNT_ID}/folders/{folderId}/videos/{videoId}`
- `bcEnsureFolder(name)` — composite: list → match by case-insensitive name → return id, else create and return id. In-memory cache keyed by name to avoid repeat lookups within a warm function instance.

### 2. `supabase/functions/brightcove-upload-init/index.ts`
- Extend the team lookup to also fetch the event name: select `events(name)` joined via `event_id`, or do a second query `from("events").select("name").eq("id", eventId)`.
- After `bcCreateVideo(...)`, call `const folderId = await bcEnsureFolder(eventName)` and then `await bcAddVideoToFolder(folderId, created.id)`.
- Wrap the folder assignment in try/catch so a folder failure doesn't break the upload flow — log and continue (video still uploads, just unfiled).
- Sanitize event name: trim, fall back to `"Event ${eventId}"` if empty.

## Out of scope
- Backfilling existing Brightcove videos into event folders.
- Renaming folders if an event is later renamed.
- Admin-side / web upload paths (not part of mobile capture).
