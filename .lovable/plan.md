# Download video from Brightcove

Add a Download action so admins can pull the original performance video file from the video host directly out of the portal.

## What you get

- A **Download** icon button on each row of the Video Submissions list (Current and Archived tabs), next to the existing "open video" and review-link buttons.
- The same **Download video** button on the submission detail page, beside the player.
- Clicking it fetches a temporary direct MP4 link from the host and starts the download named after the team, e.g. `TippyTop - Senior Level 3.mp4`.
- If the video is still rendering on the host (no playable rendition yet), the button is disabled with a tooltip explaining the video is still processing.

## How it works

Brightcove does not expose a public download URL — the MP4 rendition must be looked up server-side with account credentials.

1. **New edge function `brightcove-download-url`**
   - Admin-only (same JWT + `has_role('admin')` check pattern used by `brightcove-activate-video`).
   - Input: `{ submission_id }`. Looks up the submission's `brightcove_video_id`.
   - Calls the Brightcove CMS sources endpoint (`/v1/accounts/{account}/videos/{id}/sources`) via a new `bcGetVideoSources` helper in `supabase/functions/_shared/brightcove.ts`.
   - Picks the highest-bitrate progressive MP4 source (`container: MP4`, `src` present, no HLS/DASH).
   - Returns `{ url, filename }`, or a clear error when no MP4 rendition exists yet (still transcoding).

2. **Frontend**
   - Small shared helper (`src/lib/download-submission-video.ts`) that invokes the function and triggers the browser download via a temporary anchor with the suggested filename.
   - Wire the button into `src/pages/admin/Submissions.tsx` (row actions) and `src/pages/admin/SubmissionDetail.tsx` (header actions), with a spinner while the link resolves and a toast on failure.
   - Only rendered when the submission has a Brightcove video id; non-Brightcove URLs fall back to a plain link download.

## Notes

- No schema changes and no changes to upload, scoring, or archive behaviour.
- Reuses the existing Brightcove credentials already configured for uploads.
