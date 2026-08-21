# Template-Defined Judge Panels

Right now the panel chips shown when building a scoring field (B1, B2, T1, T2, OV, ALL) are a fixed, hard-coded list, and the template editor never passes anything else in. That works for the All Star building/tumbling layout but breaks for templates that use a different number of judges or different labels (J1, J2, J3, Dance 1/2, etc.).

The fix: make the panel slots part of the scoring template itself, so each template declares its own judge panels and everything downstream reads from that list.

## What you'll see

**Scoring template editor — new "Judge Panels" tab**
- Each template defines its own panel slots: name (e.g. "Judge 1") plus a short abbreviation (e.g. "J1"), reorderable.
- Quick-add presets: All Star Cheer (B1, B2, T1, T2, OV, SD) or Numbered Judges (J1...Jn, pick how many), plus "Add panel" for anything custom.
- Existing templates keep working: on first open, a template with no panels defined shows the abbreviations already used by its fields, with a one-click "Save these as this template's panels".

**Field builder**
- The "Assigned Judge Panels" chips now come from the template's own panel list instead of the fixed six. A template using J1–J5 shows J1–J5.
- "ALL" stays as a built-in option meaning every panel scores this field.
- If a field references a panel that no longer exists on the template, it's flagged so you can remap it before saving.

**Event setup / Assign Panels**
- When an event's teams use a template, the event's judge panels can be seeded from that template's panel list in one click, so the slots judges get assigned to always match the scoresheet.
- Assign Panels keeps working as today; it just now offers slots that match the template rather than the generic standard set.

## Technical notes

**Database**
- New table `public.scoring_template_panels`: `template_id` (FK to `scoring_templates`, cascade delete), `name`, `abbreviation`, `display_order`, timestamps, unique on `(template_id, upper(abbreviation))`.
- Grants: `SELECT` to `authenticated` (and `anon` only if templates are already readable that way), full CRUD to `authenticated` admins via policy, `ALL` to `service_role`; RLS mirroring the existing `scoring_sections` / `scoring_fields` policies.
- Backfill migration: insert one row per distinct `scoring_field_panels.panel_abbreviation` per template, ordered alphabetically, name defaulting to the abbreviation.
- No change to `scoring_field_panels` (still stores the abbreviation string) or to `judge_panels` (still per-event).

**Code**
- `src/pages/admin/ScoringTemplates.tsx`: load `panels:scoring_template_panels(*)` with the template, add a Panels tab, persist panels on save, and pass `availablePanels` (currently hard-coded `undefined`) down to `SectionTabs` → `SectionFieldsTable` → `FieldBuilderDialog`.
- New `src/components/admin/TemplatePanelsManager.tsx` for the panel list editor (mirrors `JudgePanelsManager.tsx` patterns).
- `src/components/admin/FieldBuilderDialog.tsx`: keep `DEFAULT_PANELS` only as the empty-state fallback; add the unknown-abbreviation warning.
- `src/components/admin/JudgePanelsManager.tsx`: add "Seed from scoring template" alongside the existing "Add Standard Panels".
- Judge-side matching in `ScoringQueue.tsx` / `ScorePerformance.tsx` is already abbreviation-based, so no logic change is needed there.
