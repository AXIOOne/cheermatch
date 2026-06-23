## Goal
Scoring templates become event-agnostic. Event selection is removed from the template builder. Templates are attached to a **division** instead (where event ↔ division ↔ team relationships already live).

## Schema changes (one migration)
- `scoring_templates.event_id` → make nullable, drop the foreign-key requirement. Existing rows keep their value but it's no longer used by the app.
- `divisions` → add `scoring_template_id uuid REFERENCES public.scoring_templates(id) ON DELETE SET NULL` (nullable).
- Keep `scoring_templates.is_default` so a division with no template assigned can fall back to the default template.

## Template builder (`src/pages/admin/ScoringTemplates.tsx`)
- Remove the Event select from the form and its zod validation.
- Remove the "panel abbreviations fetched from the selected event" query. Panel chips in `FieldBuilderDialog` fall back to the existing `DEFAULT_PANELS` list (`B1/B2/T1/T2/OV/ALL`).
- Drop event-related columns/labels from the template list cards (no more `event?.name`, no "Event in progress — consider locking" warning).
- Insert/update/duplicate template mutations stop sending `event_id`.
- Auto-lock-on-event-start behavior (DB trigger on `events`) is removed since templates are no longer event-scoped. Locking remains a manual toggle.

## Division UI (`src/pages/admin/Divisions.tsx`)
- Add a **Scoring Template** select to the division create/edit form (lists all templates; "Use default" option = `null`).
- Show the assigned template name in the divisions table.

## Scoring lookup (consumers)
Resolve the template through the team's division rather than the event:
- `src/pages/judge/ScorePerformance.tsx` — replace the `.eq('event_id', ...)` template query with: load `submission → team → division.scoring_template_id`, fall back to `is_default = true` if null.
- `src/components/admin/SubmissionScoringDialog.tsx` — same resolution path.
- `src/pages/admin/SubmissionScoresheet.tsx` and review token RPC — already key on `score → template_id` via the saved score row, no change needed.

## Events page (`src/pages/admin/Events.tsx`)
- Remove the **Default Template** field from the event form and the related template-update mutation block.
- Stop selecting `scoring_templates(...)` on the events query.
- Strip the small "default template" badge from the event cards.

## Out of scope
- Migrating existing event→template links into divisions. Fresh assignment by admins.
- Per-team template overrides.
- UI for managing the now-removed `auto_lock_templates_on_event_start` trigger beyond the manual lock button that already exists.
