# Archive & Delete Video Submissions

Add an archive workflow to the Video Submissions area so old or mistaken submissions can be set aside, restored, or permanently removed (including the video on the hosting service) with strong safeguards.

## What you'll see

**Tabs on the Video Submissions page**
- Two tabs: **Current** (default) and **Archived**. The event selector, search, stats, and filters apply to whichever tab is active.
- Archived submissions no longer appear in the Current tab, and are excluded from judging queues and scoring screens.

**Archiving**
- Row action and bulk action: **Archive** (available on the Current tab). A confirmation dialog explains that archived submissions leave the active list but keep their scores and video.
- The Archived tab shows who archived each submission and when.

**Restoring**
- Row action and bulk action on the Archived tab: **Restore to Current**, with a short confirmation. The submission returns to the exact status it had before archiving.

**Permanent delete (Archived tab only)**
Safeguards, all required:
1. A submission must be archived first — delete is never offered on the Current tab.
2. Delete is admin-only.
3. A destructive dialog lists exactly what will be removed (submission record, scores, and the video on the hosting service) and requires typing the team name to confirm.
4. A checkbox must be ticked to also remove the hosted video; leaving it unticked deletes only the portal record.
5. No bulk delete — one submission at a time.

## Technical notes

**Database migration (`video_submissions`)**
- Add `archived_at timestamptz`, `archived_by uuid`, `status_before_archive submission_status`.
- Index on `(event_id, archived_at)`.
- No new tables, so existing grants/RLS carry over; add an admin-only delete policy on `video_submissions` if one isn't already present.

**Filtering**
- `Submissions.tsx`: single query, split client-side on `archived_at`; tab state drives which list feeds stats and the table.
- Add `.is('archived_at', null)` to submission queries in `ScoringQueue.tsx`, `EventScoring.tsx`, `EventResults.tsx`/reports, and the mobile coach endpoints so archived work disappears from judging, results, and rankings.

**New edge function `delete-submission`**
- Verifies the caller's JWT and `admin` role.
- Requires the submission to be archived; refuses otherwise.
- If `deleteVideo` is true and `brightcove_video_id` exists, calls the Brightcove CMS delete endpoint via a new `bcDeleteVideo` helper in `supabase/functions/_shared/brightcove.ts`; a 404 from Brightcove is treated as already-gone.
- Deletes dependent rows (`score_details`, `score_deductions`, `score_skill_selections`, `score_field_overrides`, `scores`, `scoring_review_tokens`) then the submission, using the service role.
- Returns a clear error if the hosted delete fails, leaving the portal record intact so the action can be retried.

**UI files touched**
- `src/pages/admin/Submissions.tsx` (tabs, bulk archive/restore, delete entry point)
- `src/pages/admin/SubmissionDetail.tsx` (archive/restore/delete actions for a single submission)
- New `src/components/admin/DeleteSubmissionDialog.tsx` (type-to-confirm + hosted-video checkbox)
