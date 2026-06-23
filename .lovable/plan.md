## Goal
Limit judge navigation to three items — Dashboard, Scoring Queue, Rubrics — and give judges a read-only Rubrics page.

## Changes

### 1. `src/components/layout/JudgeSidebar.tsx`
- Replace the nav list with exactly: Dashboard (`/judge`), Scoring Queue (`/judge/queue`), Rubrics (`/judge/rubrics`).
- Remove the Score History link from the sidebar (route stays available so existing links/back-nav don't break).

### 2. New page `src/pages/judge/Rubrics.tsx`
- Read-only browser of `scoring_rubrics` (no upload, edit, or delete).
- Columns: Title, Event, Division, Level, Season, Uploaded.
- Search box + Event / Season filters (same as admin Rubrics).
- Download button per row using a signed URL from the `rubrics` storage bucket.
- Empty state when no rubrics exist.

### 3. `src/App.tsx`
- Import the new page and add `<Route path="rubrics" element={<JudgeRubrics />} />` inside the `/judge` route group.

### 4. RLS check (no migration unless needed)
- Verify the `scoring_rubrics` SELECT policy and the `rubrics` storage bucket policy allow `authenticated` judges to read and download. If either is admin-only today, add a policy granting `SELECT` (and storage object read) to authenticated users with role `judge`. This will be confirmed by reading current policies before writing the migration; migration only added if a gap exists.

## Out of scope
- Score History page itself (kept; just unlinked from sidebar).
- Any change to admin Rubrics management.
- Auth/role logic — `JudgeLayout` already gates the section.
