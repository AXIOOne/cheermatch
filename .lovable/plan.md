## Goal
Add a new scoring field type called **Execution Driver** that mirrors the existing Difficulty Driver pattern but works subtractively:

- Admin sets a **Start Value** for the field (e.g., 10.0 for "Stunt Execution").
- Admin lists one or more **technique issues** (e.g., "Synchronization", "Timing", "Body Position").
- Under each technique, admin defines radio options representing the **reduction** the judge can apply (e.g., 0.1, 0.2, 0.3), plus an implicit "None" (0).
- During scoring, the judge picks one option per technique. The field's score = `start_value − sum(selected reductions)`, clamped at 0.

## UX

### Admin – Field Builder (`FieldBuilderDialog`)
- Add a new option to the Field Type dropdown: **Execution Driver (start value − reductions)**.
- When selected:
  - Show a **Start Value** input (numeric).
  - Reuse the existing "skills + radio options" UI from Difficulty Driver, but relabel:
    - "Skills" → **Technique Issues**
    - "Skill name" → **Technique** (e.g., Synchronization)
    - Per-option "Value" → **Reduction** (positive number; will be subtracted)
- Validation: at least one technique, each technique has at least one reduction option.

### Judge – Score Performance (`ScorePerformance`)
- Render the field as a header showing **Start: X.X** and **Current: Y.Y** (live-updated).
- Below, one radio group per technique with a "None" option plus the configured reductions.
- Submitted field value = start − sum(selected reductions), floor 0.
- Contributes to row total like other fields (uses `max_points`).

### Scoresheet PDF / Coach review
- Display start value, each technique with the chosen reduction (or "None"), and the resulting field score.

## Technical

### Database (one migration)
- Add `'execution_driver'` to enum `scoring_field_type`.
- Add column `scoring_fields.start_value numeric` (nullable; used only when `field_type = 'execution_driver'`).
- Reuse existing tables:
  - `scoring_field_skills` → stores techniques (name/description/display_order).
  - `scoring_field_skill_options` → stores reduction options (label + numeric value).
  - `score_skill_selections` → stores the judge's chosen option per technique per score.
- No new tables, no new grants needed.

### Types & client
- `src/integrations/supabase/types.ts` is auto-generated — will refresh after migration.
- `FieldBuilderDialog.tsx`:
  - Extend `ScoringField.field_type` union with `'execution_driver'`.
  - Add `start_value?: number` to the interface and `blankField()`.
  - Add Field Type select item; render Start Value input + reuse skills UI with relabeled copy.
  - Update save-validation branch.
- `SectionFieldsTable.tsx` / `TemplatePreview.tsx`: render a small summary chip ("Start 10.0, 3 techniques").
- `ScoringTemplates.tsx`: include `start_value` in the field load/save payload.
- `SubmissionScoringDialog.tsx` (admin scoring): mirror judge rendering.

### Scoring math (`src/lib/scoring.ts` + `supabase/functions/_shared/*`)
- Add helper `computeExecutionDriverValue(startValue, selectedOptionValues[])` returning `max(0, start − sum)`.
- Wire it into the same code paths that currently sum difficulty driver selections, branching by `field_type`.
- Update `build-scoresheet.ts` (both client and edge) to show start, per-technique reduction, final value.

### Judge UI (`ScorePerformance.tsx`)
- Add an `execution_driver` branch that renders Start/Current header and a `RadioGroup` per technique with options `[None, ...reductions]`.
- Persist selections via the existing `score_skill_selections` flow.

## Out of scope
- No changes to existing difficulty_driver behavior, deductions, or other field types.
- No PDF redesign — only additive rendering of the new field.
