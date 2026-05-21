# Scoring Rubric Library

Add a place for admins to upload, organize, and manage scoring rubric documents that judges can reference while scoring. Rubrics are stored in a single library and can be tagged by season, event, level, and division so they're easy to find.

## What gets built

### Admin: Rubrics page (new)
- New nav item under Admin → "Rubrics".
- List of uploaded rubrics with: title, file type icon, season, event, level, division, uploaded by, uploaded date.
- Filters: season, event, level, division, file type, free-text search on title/description.
- Actions: Upload new rubric, Edit metadata, Download, Replace file, Delete.
- Upload dialog: title, description, season (free-text e.g. "2026"), optional event, optional division, optional level, file picker.
  - If an event is chosen, the division/level pickers filter to that event's options.
  - All scoping fields are optional — a rubric can be fully global, season-only, or tied to a specific event/level/division.
- Accepts any document or image: PDF, Word (.doc/.docx), images (.png/.jpg/.webp), spreadsheets (.xls/.xlsx), text.
- File size cap: 25 MB per file.

### Judge: Rubric reference
- On the judge scoring page (`ScorePerformance`), add a "Rubrics" panel/button that opens a side sheet listing rubrics relevant to the current submission's event/division/level (plus any season-tagged or global rubrics).
- Each item shows title + description and a Download / Open-in-new-tab link.
- Read-only — judges cannot upload, edit, or delete.

## Technical details

### Storage
- New private Supabase storage bucket: `rubrics`.
- File path convention: `rubrics/{rubric_id}/{original_filename}`.
- Access via short-lived signed URLs generated on demand (no public bucket).

### Database
New table `public.scoring_rubrics`:
- `id uuid pk`
- `title text not null`
- `description text`
- `season text` (free-text, e.g. "2025-2026")
- `event_id uuid` (nullable, references events)
- `division_id uuid` (nullable, references divisions)
- `level_id uuid` (nullable, references levels)
- `file_path text not null` (storage object path)
- `file_name text not null` (original filename for download)
- `file_size_bytes bigint`
- `mime_type text`
- `uploaded_by uuid not null` (auth user id)
- `created_at`, `updated_at` timestamps + trigger

Indexes on `event_id`, `division_id`, `level_id`, `season` for filter performance.

### RLS (Admins + Judges only)
- `scoring_rubrics` table:
  - SELECT: admins or judges (`has_role` check).
  - INSERT / UPDATE / DELETE: admins only.
- `rubrics` storage bucket policies:
  - SELECT on objects: admins or judges.
  - INSERT / UPDATE / DELETE on objects: admins only.
- Bucket is private; the UI requests signed URLs to view/download.

### Frontend
- New files:
  - `src/pages/admin/Rubrics.tsx` — list, filters, upload/edit/delete flows.
  - `src/components/admin/RubricUploadDialog.tsx` — upload + metadata form.
  - `src/components/judge/RubricReferenceSheet.tsx` — judge-facing side sheet.
- Edits:
  - `src/App.tsx` — add `/admin/rubrics` route.
  - `src/components/layout/AdminSidebar.tsx` — add nav entry (FileText icon).
  - `src/pages/judge/ScorePerformance.tsx` — add "Rubrics" trigger that opens the reference sheet, filtered by the current submission's event/division/level.

## Out of scope (for this pass)
- Version history of rubric files (replace = overwrite; no historical versions kept).
- Coach-facing rubric visibility.
- Inline PDF viewer (we open/download in a new tab; can add a viewer later if desired).
