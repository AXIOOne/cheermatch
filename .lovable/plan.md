## Admin Score Override (Zero Individual Fields)

Allow admins to override any individual judge's field score on a scoresheet to 0, with a required reason and full audit trail.

### 1. Database
- New table `score_field_overrides`:
  - `score_id`, `field_id`, `original_points`, `new_points` (always 0 for now, but stored for flexibility), `reason` (text, required), `overridden_by` (admin user_id), `created_at`.
- RLS: only admins can insert/select; service_role full access.
- When an override exists for a `(score_id, field_id)`, all score-reading logic treats that field's points as the overridden value.

### 2. Admin UI (Submission Scoring Dialog / Scoresheet view)
- For each judge's field row, add a small "Override" button (admin-only).
- Clicking opens a confirmation dialog:
  - Shows current points and the field's max.
  - Required textarea: "Reason for override".
  - Confirm button: "Set to 0".
- Once overridden, the row displays:
  - Score struck through, "0" shown in red beside it.
  - Small info icon with tooltip: reason, admin name, timestamp.
  - "Remove override" action to restore the original score.

### 3. Recalculation
- Update `build-scoresheet.ts` (and the shared edge-function copy) to apply overrides before summing field points.
- Update `scores.total_score` recompute logic: raw % = sum(effective field points) / template max × 100, then subtract deductions — same formula already in place, just using overridden values.
- Re-trigger total recompute whenever an override is added or removed.

### 4. PDF & Reports
- PDF scoresheet renders overridden fields with a "0*" marker and a footnote: "* Score overridden by admin".
- Event Results, Event Reports, Score History continue to read recomputed totals — no extra changes needed beyond the recompute hook.

### Technical Notes
- Files touched: new migration; `src/components/admin/SubmissionScoringDialog.tsx`; `src/lib/build-scoresheet.ts` + `supabase/functions/_shared/build-scoresheet.ts`; `src/lib/scoresheet-pdf.ts` + shared copy; new small component `ScoreFieldOverrideDialog.tsx`.
- Recompute runs client-side after override mutation, mirroring existing total_score update logic.
- Only `admin` role can see the Override controls or call the mutation (enforced via RLS + UI gating).
