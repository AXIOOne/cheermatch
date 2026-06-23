## Context

The previous round already wired up most of this request:

- `divisions.scoring_template_id` column exists.
- The **Create Division** dialog has a "Scoring Template" select (with "Use default template" fallback).
- The divisions table shows the assigned template name.
- Scoring resolution in `SubmissionScoringDialog.tsx` and `judge/ScorePerformance.tsx` walks `submission → team → division.scoring_template_id`, falling back to the global `is_default` template.

So when a team in that division is registered in an event and a video is scored, the right template is already pulled automatically.

## What's missing

The Divisions page only supports **Create** and **Delete** — there is no **Edit** action. Any division created before this feature (or one where you picked the wrong template) is stuck unless deleted and recreated, which would orphan teams.

## Plan

Add edit support to `src/pages/admin/Divisions.tsx`:

1. Reuse the existing division `Dialog` for both create and edit by tracking an `editingDivision` state.
2. When opening in edit mode, prefill the form (`name`, `min_age`, `max_age`, `description`, `scoring_template_id` — defaulting to `UNASSIGNED_TEMPLATE` when null).
3. Add an `updateDivisionMutation` that runs `supabase.from('divisions').update({...}).eq('id', editingDivision.id)` with the same null-coalescing for `scoring_template_id`.
4. Add a pencil/Edit button in the divisions table row alongside the existing Delete button that opens the dialog in edit mode.
5. Dialog title and submit button label switch between "Create Division" / "Edit Division" based on mode; reset `editingDivision` on close.

No schema migration, no changes to scoring resolution, no changes to Events or Teams pages.

### Files touched
- `src/pages/admin/Divisions.tsx`

## Out of scope
- Per-team template overrides.
- Backfilling templates onto existing divisions automatically.
- Showing the resolved template inside Events / Teams views.