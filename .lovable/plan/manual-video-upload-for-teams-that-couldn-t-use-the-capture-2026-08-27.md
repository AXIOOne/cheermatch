# Manual video upload for teams that couldn't use the capture app

Admins can upload a performance video directly for any registered team, creating a submission as if the coach had submitted it.

## What you'll see

- An **Upload video** button at the top of the Video Submissions screen.
- A dialog where you pick the event (defaults to the currently selected one), pick a team from that event, choose a video file, and upload.
- Progress bar during upload, then the submission appears in the list with status **Uploaded** and processes on the video host like any other submission.
- On the **Awaiting video** tab, each team that captured attempts but never picked a final video gets an **Upload for team** action, which opens the same dialog pre-filled with that event and team.
- Teams that already have a live submission are not offered here — those use the existing **Replace video** action.

## Technical notes

- Reuse the existing `admin-replace-video` flow instead of a new upload pipeline. Add a `team_id` path to that edge function:
  - `action: "init"` accepts either `submission_id` or `event_id` + `team_id`. In the team case it looks up an existing non-archived submission for that team/event; if none, it creates one (`status: 'pending'`, `submitted_via: 'admin'`) and returns its id along with the Brightcove video id, signed URL and ingest URL. Naming, tagging and event-name folder assignment stay identical.
  - `action: "complete"` is unchanged and takes the returned `submission_id`.
  - Admin-only check (`has_role admin`) remains in place; input validated as UUIDs.
- Front end: generalise `ReplaceVideoDialog` into a shared upload dialog that accepts either a `submissionId` or `{ eventId, teamId }`, keeping the existing copy for the replace case and different wording plus a "delete previous video" checkbox hidden for the manual case (there is no previous video).
- Team picker query: `teams` filtered by `event_id`, showing team name, gym, division/level, sorted by name.
- On success invalidate the submissions and attempts queries so both tabs refresh.
- No schema changes needed; `video_submissions.submitted_via = 'admin'` marks these as manual uploads and `submitted_by` records the admin.
