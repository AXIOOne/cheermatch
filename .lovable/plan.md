
## Goal

Within a scoring template section, allow each sub-category (Difficulty, Execution, drivers, etc.) to be assigned to a specific judge-panel slot (B1, B2, T1, T2, J1, J2…). At scoring time, a judge only sees the categories that belong to their panel, so two judges can split one section.

## Approach

Store a **panel abbreviation string** on each `scoring_categories` row (e.g. "B1", "B2"). We use a free-text abbreviation, not a hard FK, because templates are universal but `judge_panels` are per event — abbreviations are the bridge already used everywhere else (judge_panels.abbreviation, judge_assignments.panel → judge_panels.id with matching abbreviations across events).

Inheritance rule: if a category has no panel set, it inherits from its parent; if the parent has none, it inherits from the section's default panel; if the section has no default, the category is visible to every panel mapped to that section.

## Changes

### 1. Database (single migration)

```sql
ALTER TABLE public.scoring_categories
  ADD COLUMN panel_abbreviation TEXT;

ALTER TABLE public.scoring_sections
  ADD COLUMN default_panel_abbreviation TEXT;
```

No RLS changes needed (existing policies cover the new columns).

### 2. Scoresheet builder UI

**`src/components/admin/ScoringCategoryTree.tsx`**
- Extend `CategoryItem` with `panel_abbreviation?: string`.
- Add a 4th compact field in `CategoryFields`: a "Panel" input (short text, max 4 chars, placeholder "B1"). Empty = inherit.

**`src/components/admin/SectionTabs.tsx`**
- Extend `ScoringSection` with `default_panel_abbreviation?: string`.
- Add a "Default Panel" input next to Abbreviation in the section header.
- Update the new B1/B2/T1/T2 default sections to seed:
  - B1 section default_panel = "B1", B2 = "B2", T1 = "T1", T2 = "T2", OV = "OV", ALL = "" (all).

### 3. Save / load in templates page

**`src/pages/admin/ScoringTemplates.tsx`**
- Include `panel_abbreviation` when reading categories and `default_panel_abbreviation` when reading sections.
- Persist both fields in the create + update paths (`flattenCategories` insert, sections insert, and the update branch).

### 4. Scoring runtime filter

**`src/components/admin/SubmissionScoringDialog.tsx`** and any judge scoring view that renders a scoresheet (`src/pages/admin/SubmissionScoresheet.tsx`, judge scoring queue/score page if they render categories directly):
- Determine the active panel abbreviation from the current `judge_assignment` / panel selector (already exists).
- When rendering categories, hide any leaf category whose effective panel (self → parent → section default) is set and does not match the active panel abbreviation. If no panel is set anywhere on the chain, show it (back-compat).
- Recompute the visible section subtotal/total from only the visible leaf categories.

### 5. Types

`src/integrations/supabase/types.ts` auto-regenerates after the migration runs.

## Out of scope

- No change to `judge_panels` or `judge_assignments` — assignment of *people* to panels stays exactly as it is today.
- No change to score submission logic; judges still submit one score row per panel and only fill in the categories they see.

## Files touched

- `supabase/migrations/<new>.sql` (new)
- `src/components/admin/ScoringCategoryTree.tsx`
- `src/components/admin/SectionTabs.tsx`
- `src/pages/admin/ScoringTemplates.tsx`
- `src/components/admin/SubmissionScoringDialog.tsx`
- `src/pages/admin/SubmissionScoresheet.tsx` (verify, edit if it renders categories)
