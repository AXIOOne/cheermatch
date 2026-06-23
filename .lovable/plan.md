## Goal
Rework the Submissions tab around a clear lifecycle: **imported → approved (or denied) → assigned → complete**. Remove scoring details from this view — it's purely for intake, approval, and status tracking.

## Status Lifecycle

| Status | When it's set | How |
|---|---|---|
| `imported` | A submission first enters the system | Default on insert |
| `approved` | Staff has reviewed the video and accepts it for scoring | Manual action in Submissions tab |
| `denied` | Staff rejects the video | Manual action in Submissions tab |
| `assigned` | Submission has been assigned to a judge | Auto-set when a `judge_assignments` row is created for it |
| `complete` | The parent event is closed | Auto-set when the event status becomes `completed`/closed |

## Database changes
1. Extend the `submission_status` enum with the new values: `imported`, `approved`, `denied`, `assigned`, `complete`. (Existing values stay so legacy rows don't break; we just stop using them in the UI.)
2. Change the default of `video_submissions.status` to `imported`.
3. Backfill: any current `pending`/`uploaded`/`processing`/`ready` → `imported`; `failed` left alone or mapped to `denied` (will confirm — see Open question).
4. Trigger on `judge_assignments` insert: set the submission's status to `assigned` if it's currently `approved`.
5. Trigger on `events` update: when an event transitions to closed, set all of that event's submissions with status in (`approved`, `assigned`) to `complete`.

## Submissions page (`src/pages/admin/Submissions.tsx`)
- Replace the status-config map with the five new statuses and matching colors/icons (imported = neutral, approved = green, denied = red, assigned = blue, complete = teal).
- Stats cards become: **Total / Imported / Approved / Assigned / Complete** (drop Pending/Ready/Failed).
- Status filter dropdown reflects the new five values.
- Per-row status cell becomes a **read-only badge** (no manual dropdown to arbitrary values).
- Per-row actions:
  - When status = `imported`: show **Approve** and **Deny** buttons.
  - When status = `denied`: show **Re-approve** (sets back to `approved`).
  - When status = `approved` / `assigned` / `complete`: status is informational only (no approve/deny buttons).
- Keep: bulk selection, Send Review Links, external video link, generate review link, search, event filter, row click → submission detail page.
- Remove anything that surfaces scoring details on this page (we already don't show scores here; will double-check nothing leaked in via the detail link section — the row link to `/admin/submissions/:id` stays since that's a separate page).

## Out of scope
- The submission detail/scoresheet page is untouched.
- Judge assignment UI is untouched — only the DB trigger reacts to new assignments.
- Event close UI is untouched — only the DB trigger reacts to status change.

## Open question
For existing `failed` submissions (videos that failed to process), should they be migrated to `denied` or left as `imported` for staff to re-review? I'll default to **`imported`** unless you say otherwise.
