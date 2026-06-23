## Assign Panels (Event Scoring)

Rename the "Configure Panels" button on `/admin/events/:id/scoring` to **Assign Panels** and replace its dialog with a tabbed interface for assigning a specific judge to each scoring section, grouped by the divisions that currently have submitted teams.

### UX

Button label changes from "Configure Panels" → "Assign Panels".

Dialog (wider, ~max-w-4xl) with two tabs:

1. **Assignments** (default tab)
   - Loads the active scoring template for the event and all sections (grouped by their panel via `default_panel_abbreviation`).
   - Loads divisions that have at least one `video_submissions` row for this event (status ≠ `withdrawn`/`rejected`), via `teams.division_id`.
   - Renders one collapsible card per division. Inside each: a row per scoring section showing section name, its panel badge, and a Judge select dropdown.
   - Judge dropdown lists users with the `judge` role (`user_roles` + `profiles`).
   - Saves immediately on change (upsert).

2. **Panel Definitions**
   - Houses the existing `JudgePanelsManager` so admins can still add/remove panel rows (B1, B2, T1…) used by sections.

### Data model

Current `judge_assignments` is `(event_id, judge_user_id, division_id, level_id, panel_id)` — panel-grain only. To support per-section assignment, add a nullable `section_id uuid` column referencing `scoring_sections(id) ON DELETE CASCADE`, plus a partial unique index `(event_id, division_id, section_id) WHERE section_id IS NOT NULL` so each section has one judge per division.

No data backfill. Existing rows (panel-level) remain untouched and continue to work for legacy lookups; the new UI writes section-level rows.

### Files

- **Migration**: add `section_id` column + index to `public.judge_assignments`.
- **`src/pages/admin/EventScoring.tsx`**: button label → "Assign Panels"; swap dialog content for new component; widen dialog.
- **`src/components/admin/AssignPanelsDialog.tsx`** (new): tabbed UI described above.
- **`src/components/admin/JudgePanelsManager.tsx`**: unchanged, embedded in the second tab.

### Queries used by the new dialog

- Scoring template + sections: `scoring_templates` (where `event_id=` and `is_default=true`) → `scoring_sections` ordered by `display_order`.
- Divisions with submissions: `video_submissions` joined to `teams` → distinct `division_id` + name.
- Judges list: `user_roles` where `role='judge'` joined to `profiles` (full_name, email).
- Existing assignments: `judge_assignments` where `event_id=` and `section_id is not null`, keyed by `${division_id}:${section_id}` for fast lookup.
- Upsert on judge select: insert if missing, update `judge_user_id` if present, delete if cleared.

### Out of scope

- No changes to the per-team scoring flow or how scores reference panels.
- No backfill of existing panel-level assignments into section-level rows.
- No bulk-assign UX (e.g. "apply this judge to all B1 sections across divisions") — single-row edits only for v1.