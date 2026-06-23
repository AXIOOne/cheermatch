## Goal
Rebuild the Divisions & Levels page so adding a division captures **Discipline → Title → Scoring Template (+ Level for Cheer)**, and drop the old separate Levels hierarchy.

## Database
Add two columns to `public.divisions`:
- `discipline` — text, constrained to `'cheer'` or `'dance'`, NOT NULL (default `'cheer'` for backfill).
- `level` — text, nullable (only used when discipline is `cheer`). Allowed values: `Level 1, Level 2, Level 3, Level 4, Level 4.2, Level 5, Level 6`.

Backfill existing rows with `discipline='cheer'` and `level=NULL`.

The legacy `levels` table is left in place (teams may still reference it via `level_id` historically), but it stops being managed in the admin UI.

## UI — `src/pages/admin/Divisions.tsx`
- Remove the **Tabs** wrapper and the entire **Levels** tab. Page becomes a single Divisions list.
- Drop `min_age` / `max_age` inputs from the form.
- New "Add / Edit Division" dialog fields:
  1. **Discipline** — Select: Cheer / Dance
  2. **Division Title** — Text input
  3. **Scoring Template** — Select populated from all `scoring_templates` (no "Use default" option; required)
  4. **Level** — Select with the 7 options above, **shown only when Discipline = Cheer**, required in that case; cleared/ignored when Dance is selected.
- Table columns: **Discipline | Title | Level | Scoring Template | Actions**.

## Out of scope
- The `levels` table itself stays for now (still referenced by teams). We'll revisit removing it once event registration is reworked.
- Event registration flow is untouched in this change.
