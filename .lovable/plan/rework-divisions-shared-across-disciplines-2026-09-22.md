# Rework: Divisions shared across disciplines

Today a division belongs to exactly one discipline and carries one scoring template. The rework makes a division a reusable definition (name + level) that can be switched on for any number of disciplines, each with its own scoring template.

## How it will work

**Creating a division**
- Name (e.g. "Senior Coed")
- Level: optional, picked from the existing Levels list
- Disciplines: a checklist of all disciplines. Tick the ones this division runs in, and for each ticked discipline choose the scoring template that applies (templates are already filtered per discipline).

A division can be active in All-Star Cheer with one template and in USA Cheer with a different one.

**Divisions page**
- One row per division showing name, level, and a badge per active discipline.
- The discipline filter tabs stay and now show every division activated for that discipline.

**Events and registration**
- An event still picks a discipline.
- When registering or editing a team, the division dropdown shows only divisions activated for that event's discipline.
- Judging, scoresheets, panel assignment, and reports resolve the template from the division plus the event's discipline instead of the division's single template field.

**Existing data**
- The 139 existing divisions each become a division activated for their current discipline, keeping their current template and level. Nothing is lost and no event breaks.
- Duplicate names across disciplines don't exist today, so no merging is needed. Admins can later activate an existing division for extra disciplines instead of creating a copy.

## Technical notes

- New table `public.division_disciplines` (`division_id`, `discipline`, `scoring_template_id`, unique on division+discipline), with grants, RLS mirroring `divisions` (admins write, authenticated read), and `created_at`/`updated_at` plus update trigger.
- New column `divisions.level_id` referencing `public.levels` (nullable), backfilled by matching the existing `level` text against `levels.name`. The old `level` and `discipline` columns stay in place for one release as fallbacks; `divisions.scoring_template_id` also stays as fallback.
- Backfill migration: insert one `division_disciplines` row per existing division from its current `discipline` + `scoring_template_id`.
- Shared helper `resolveDivisionTemplateId(divisionId, discipline)` in `src/lib/scoring.ts` and a mirror in `supabase/functions/_shared/`, used by `ScoringQueue.tsx`, `ScorePerformance.tsx`, `SubmissionScoringDialog.tsx`, `AssignPanelsDialog.tsx`, `JudgePanelsManager.tsx`, `build-rankings.ts`, `download-submission-scoresheet.ts`, and `send-scoresheet-email`. Resolution order: `division_disciplines` row for the event discipline, then `divisions.scoring_template_id`.
- `Divisions.tsx` rewritten: level select sourced from `levels`, per-discipline activation rows with template select, upsert writes division + diff of its `division_disciplines` rows.
- `EditTeamDialog.tsx` and `EventParticipants.tsx` filter divisions via `division_disciplines` joined on the event's discipline.
- A division activated for a discipline without a chosen template is blocked at save time, so panel assignment never sees an untemplated division.

## Out of scope

- No changes to scoring template structure, panels, or the `team_levels` legacy table.
