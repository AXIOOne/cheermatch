# Delete Registration (keep video submission)

## Goal
Add a delete action for individual registrations (teams). When a deleted registration has a video submission, the submission is kept but detached from the registration.

## Current state (verified)
- No delete button exists for registrations on the Registrations or Participants screens.
- `video_submissions.team_id` is NOT NULL with ON DELETE CASCADE — deleting a team today would delete its submission.
- Teams already have an admin delete RLS policy ("Admins can manage all teams"), so no policy changes are needed.

## Plan

### 1. Database change (one migration)
- Make `video_submissions.team_id` nullable (drop NOT NULL).
- Change the `video_submissions.team_id` foreign key from ON DELETE CASCADE to ON DELETE SET NULL, so deleting a team detaches its submission instead of deleting it.
- Capture attempts tied to the team (by team_id) are removed with the registration — attempt history belongs to the registration.
- Judge scores stay with the kept submission (they cascade from the submission, which now survives).

### 2. Delete action in the UI (EventRegistrations.tsx)
- Add a Delete (trash) icon button on each registration row, next to Edit.
- Clicking it opens a confirmation dialog:
  - If the registration has no video submission: simple "Delete this registration?" confirm.
  - If it has one: warn that the registration will be deleted but its video submission will be kept, unlinked from any registration.
- On confirm, delete the team row; the database detaches the submission automatically. Refresh the list.

### 3. Handle detached submissions in the app
- Submissions list (Submissions.tsx) and SubmissionDetail.tsx: left-join the team and show a fallback label like "Registration deleted" (with the submission number) instead of the team name/gym.
- EventScoring.tsx: same fallback so the scoring control panel doesn't break on a detached submission.
- Scoring queue, reports, rankings, and scoresheets join teams and will naturally exclude detached submissions (no team = not scoreable) — verify these screens still load without errors when a detached submission exists.
- Judge assignments, panels, and divisions are unaffected (they never reference the team row directly).

### 4. Verification
- Run the migration and confirm the type definitions regenerate cleanly.
- Build + typecheck.
- In the preview: delete a test registration with a submission, confirm the submission survives, shows the fallback label, and scoring/report screens still work.

## Files touched
- `supabase/migrations/` (new migration)
- `src/pages/admin/EventRegistrations.tsx` (delete button + confirm dialog)
- `src/pages/admin/Submissions.tsx`, `src/pages/admin/SubmissionDetail.tsx`, `src/pages/admin/EventScoring.tsx` (fallback label / left join)
- `src/integrations/supabase/types.ts` (auto-regenerated)
