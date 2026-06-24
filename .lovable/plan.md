## Difficulty Driver Field Type

Adds a new `difficulty_driver` field type to scoring templates. Each difficulty driver field contains a list of "skills" (subfields); each skill has its own set of radio options (label + point value). When scoring, the judge picks one radio per skill. The field's final value is the **sum of selected option values, with no cap**.

### 1. Database

Migration adds:

- Extend enum `scoring_field_type` with value `'difficulty_driver'`.
- New table `public.scoring_field_skills`
  - `field_id` → `scoring_fields.id` (cascade delete)
  - `name`, `description`, `display_order`
  - timestamps + RLS mirroring `scoring_fields` (admins manage, judges/coaches read)
  - `GRANT`s for `authenticated` and `service_role`
- New table `public.scoring_field_skill_options`
  - `skill_id` → `scoring_field_skills.id` (cascade delete)
  - `label`, `value` (numeric, can be negative), `display_order`
  - timestamps + RLS + grants
- New table `public.score_skill_selections`
  - `score_id` → `scores.id` (cascade delete)
  - `skill_id` → `scoring_field_skills.id`
  - `option_id` → `scoring_field_skill_options.id`
  - unique (`score_id`, `skill_id`)
  - RLS: judge can write rows for their own score; admins read all; coaches read via review token (mirror existing `score_details` policies)

Existing `scoring_field_options` is unchanged — radio options live on the new `scoring_field_skill_options` table because they belong to a skill, not the field.

### 2. Template builder UI

`FieldBuilderDialog.tsx`:

- Add `'difficulty_driver'` to the `field_type` Select.
- When selected, hide the number-range and flat-options blocks and show a new **Skills** section:
  - Add Skill button.
  - Each skill row: name input + nested list of `{label, value}` radio options + Add Option / Remove buttons.
  - Validation: must have ≥1 skill, each skill must have ≥1 option, names non-empty.
- Extend `ScoringField` type with `skills: { temp_id, id?, name, display_order, options: { temp_id, id?, label, value, display_order }[] }[]`.

`ScoringTemplates.tsx`:

- Persist `skills` and nested `options` on save (insert/update/delete cascading).
- Load skills + options when editing an existing template.

`SectionFieldsTable.tsx` + `TemplatePreview.tsx`:

- Show a "Difficulty Driver" badge for the new type.
- Preview renders each skill with its radio choices.

### 3. Judge scoring UI

`ScorePerformance.tsx` and `SubmissionScoringDialog.tsx`:

- Render difficulty driver fields with one radio group per skill (`<RadioGroup>` from shadcn).
- Local state map `{ [skillId]: optionId }`. The field's `points` value is computed live as `sum(selectedOption.value)` and shown next to the field name.
- On submit, write rows into `score_skill_selections` and a single `score_details` row carrying the computed sum (so existing aggregation/totals keep working unchanged).

### 4. Scoresheet / PDF

`build-scoresheet.ts` (client + edge-function copy) and `scoresheet-pdf.ts`:

- Load skill selections only to compute the value (already stored on `score_details`).
- PDF row renders **total only**: field name + computed value, exactly like other fields. No skill breakdown in the PDF per the answer.

### 5. Out of scope

- Capping or averaging behavior (sum with no cap).
- Per-skill required/optional flags ("just name + radio options").
- Skill breakdown in the PDF ("total only").

### Files touched

- `supabase/migrations/<new>.sql`
- `src/integrations/supabase/types.ts` (auto-regenerated)
- `src/components/admin/FieldBuilderDialog.tsx`
- `src/components/admin/SectionFieldsTable.tsx`
- `src/components/admin/TemplatePreview.tsx`
- `src/pages/admin/ScoringTemplates.tsx`
- `src/pages/judge/ScorePerformance.tsx`
- `src/components/admin/SubmissionScoringDialog.tsx`
- `src/lib/build-scoresheet.ts`
- `src/lib/scoresheet-pdf.ts`
- `supabase/functions/_shared/build-scoresheet.ts`
- `supabase/functions/_shared/scoresheet-pdf.ts`
- `supabase/functions/send-scoresheet-email/index.ts` (fetch shape)
