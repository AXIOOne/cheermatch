## Goals

1. Reformat `src/pages/judge/ScorePerformance.tsx` so the video is the primary focus, with team info stacked beside it and scoring fields below.
2. Add a "Submit & Flag" button next to "Submit Score" that captures a flag reason, then submits the score with a "Needs Review" status visible in the admin scoring control panel.

## Layout changes (judge scoring screen)

New structure replacing the current `lg:grid-cols-2` split:

```text
+--------------------------------------------+-----------------+
|                                            | Team Info       |
|              VIDEO PLAYER (large)          |  - Team name    |
|              (≈ 2/3 width on desktop)      |  - Gym          |
|                                            |  - Division     |
|                                            |  - Level        |
|                                            |  - Event        |
|                                            |  - Athletes     |
|                                            |  - Duration     |
+--------------------------------------------+-----------------+
|  SCORING FIELDS (sections + inputs)        | Judge Comments  |
|  (≈ 2/3 width)                             | (textarea)      |
|                                            |                 |
|  Deductions block below scoring fields     |                 |
+--------------------------------------------+-----------------+
```

- Top row: video left (col-span-2), team info card stacked right (col-span-1).
- Bottom row: scoring sections left (col-span-2), comments card right (col-span-1, sticky).
- Mobile: everything stacks single-column (video → team → scoring → comments).
- Preserve existing rubric reference, panel badges, save/submit buttons, locked/closed states.
- No changes to data fetching, visibility filtering, or score calculation logic.

## Submit & Flag flow

Header buttons (when not locked):
`Save Draft` | `Submit Score` | `Submit & Flag` (warning-styled).

Clicking **Submit & Flag** opens a modal (`Dialog`) requiring a non-empty reason. On confirm, the score is saved with `status = 'submitted'`, `needs_review = true`, and the reason persisted.

### Reason storage

Add a `review_reason` (text, nullable) column to `public.scores` via migration. The existing `needs_review` boolean is already in use by `EventScoring.tsx`, which already maps `needs_review` → orange/yellow "Needs review" status — no admin changes needed for the badge.

### Mutation changes

Extend `saveMutation` to accept `{ status, needsReview?, reviewReason? }`:
- On insert/update, set `needs_review` and `review_reason` accordingly.
- `Submit Score` clears `needs_review` to `false` and `review_reason` to `null`.
- `Submit & Flag` sets `needs_review = true` and stores the reason; status `submitted`; navigates back to queue with a toast.

## Technical details

Files:
- `src/pages/judge/ScorePerformance.tsx` — layout restructure, new flag button + dialog, mutation params.
- New migration: `ALTER TABLE public.scores ADD COLUMN review_reason text;` (no new policies needed; existing scores policies cover it).
- Optional: surface `review_reason` in `src/pages/admin/EventScoring.tsx` tooltip/dialog so admins see why the judge flagged it (small select-list addition + display in the existing score editor).

No changes to RLS, GRANTS (column-level inherits), or other judge/admin pages beyond the optional reason display.
