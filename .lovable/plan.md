
# Scoring Template Builder v2

A scoresheet = **Sections (rows)** × **Fields (columns)**. Each field is owned by one or more judge panel slots (B1, B2, T1…). Deductions remain as today.

## 1. New data model (fresh start, replaces category tree)

```text
scoring_templates
  └── scoring_sections          (rows of the scoresheet — admin defined)
        └── scoring_fields      (NEW — the column definitions)
              └── scoring_field_options   (NEW — for dropdown fields)
              └── scoring_field_panels    (NEW — which panel slots own this field)
  └── deduction_types           (unchanged)
```

**scoring_fields**
- section_id, name, display_order
- field_type: `number` | `dropdown`
- number config: min, max, step, max_points
- aggregation (used only when assigned to >1 panel): `average` | `trimmed_mean` | `min` | `max` | `sum`

**scoring_field_options** (dropdown only)
- field_id, label, value (numeric points), display_order

**scoring_field_panels**
- field_id, panel_abbreviation (e.g. `B1`, `B2`)
- One row per assigned panel slot. 1 row = single-judge field. 2+ rows = multi-judge, aggregated per field's `aggregation`.

The old `scoring_categories` table and its sub-tree concept are dropped. Existing templates (incl. the USASF sample) are removed in the same migration — clean slate per your choice.

Scores model change:
- `score_details` keys on `field_id` instead of `category_id`.
- For multi-judge fields, each judge writes their own `score_details` row; final scoresheet aggregates per the field's rule.

## 2. Builder UI (`/admin/scoring` → template editor)

Layout:

```text
┌─ Template: USASF L4 ────────────────────────────────┐
│ [+ Add Section]                                     │
│                                                     │
│ ▾ Stunts                      max 10.0   [⋯][🗑]   │
│   ┌──────────────────────────────────────────────┐  │
│   │ Field            Type     Panel(s)   Range   │  │
│   │ Difficulty       Number   B1         0–5/.25 │  │
│   │ Execution        Number   B1, B2 avg 0–5/.25 │  │
│   │ Creativity       Dropdown OV         3 opts  │  │
│   │ [+ Add Field]                                │  │
│   └──────────────────────────────────────────────┘  │
│ ▾ Pyramids …                                        │
│ ▾ Tumbling …                                        │
│                                                     │
│ ── Deductions (unchanged manager) ──                │
└─────────────────────────────────────────────────────┘
```

**Add Field dialog**
- Name
- Type: Number | Dropdown
- If Number: min, max, step, max points
- If Dropdown: repeatable rows of `label` + `points`
- Panels: multi-select chips of available panel abbreviations (pulled from the event's `judge_panels`, falling back to B1/B2/T1/T2/OV/ALL)
- If 2+ panels selected: show Aggregation select (Average / Trimmed mean / Min / Max / Sum), default Average

Sections support reorder + max points display (auto-sum of fields' max).

## 3. Scoring interface changes

`SubmissionScoringDialog`:
- Renders sections as rows; within each row, only the fields whose `scoring_field_panels.panel_abbreviation` matches the current judge's assigned panel.
- Number field: shadcn `Input type=number` with stepper +/- buttons honoring `step`.
- Dropdown field: shadcn `Select` of the configured options; stored value = option points.
- Judge sees only their own fields; multi-judge fields appear independently for each assigned judge.

Final scoresheet / `EventResults` / review portal:
- Per field, compute the displayed value via the field's aggregation across all submitted `score_details` for that field.
- Section subtotal = sum of aggregated field values. Total = sum of sections − deductions.

## 4. Migration & cutover plan

1. **Migration A (schema)**: create `scoring_fields`, `scoring_field_options`, `scoring_field_panels`; add `field_id` to `score_details` (nullable for now); add GRANTs + RLS policies mirroring current scoring tables.
2. **Migration B (cleanup)**: delete all rows in `scores`, `score_details`, `score_deductions`, `scoring_categories`, `scoring_sections`, `scoring_templates`, `deduction_types` (fresh start, per your choice). Drop `scoring_categories` table and the `category_id` column on `score_details`.
3. **Code**:
   - New components: `FieldBuilderDialog.tsx`, `SectionFieldsTable.tsx`. Replace `ScoringCategoryTree.tsx` usage in `SectionTabs.tsx` / `ScoringTemplates.tsx`.
   - Update `SubmissionScoringDialog.tsx`, `TemplatePreview.tsx`, `EventResults.tsx`, review token RPC `get_review_by_token`, and `send-scoresheet-email` edge function to read fields instead of categories.
   - Regenerate Supabase types after migration.
4. Keep `judge_panels` and panel-abbreviation concepts as-is — they're the source of truth for the panel selector.

## 5. Out of scope (call out)

- Per-field weights/multipliers (not requested).
- Drop-high/drop-low for averaging (covered by `trimmed_mean` option but UI only exposes the chosen mode).
- Importing the old USASF sample data — wiped in step 2.
