# Workflow Audit — Fixes

The 8-step workflow is mostly wired up. Two gaps remain:

- **Step 5** — there is no `open_for_scoring` event status, so judges can score the moment they're assigned.
- **Step 8** — Send / Download scoresheet unlocks once all panels have *submitted*, not once all panels have been *reviewed*.

## Changes

### A. Add `open_for_scoring` event status (Step 5)

1. **Migration** — add `'open_for_scoring'` value to the `event_status` enum (placed after `registration_closed`, before `in_progress`).
2. **Admin Events UI** (`src/pages/admin/Events.tsx`)
   - Add `open_for_scoring` to the zod schema and the status `Select` options.
   - Show it as a distinct badge color.
3. **Judge gating**
   - `src/pages/judge/ScoringQueue.tsx`: only show submissions whose event status is `open_for_scoring` (continue to include `in_progress` for backward compat).
   - `src/pages/judge/ScorePerformance.tsx`: block save/submit mutations when the event is not `open_for_scoring` / `in_progress`; show inline notice.
4. **Template auto-lock** — the existing template-locking flow keys off `in_progress`; extend it to also lock when an event moves to `open_for_scoring`.

### B. Gate scoresheet on full review (Step 8)

In `src/pages/admin/EventScoring.tsx`:
- Compute `allReviewed` = every expected panel score row has `reviewed_at IS NOT NULL`.
- Use `allReviewed` (not `allComplete`) to enable **Send Score Sheet** and **Download PDF**.
- Add a per-submission "Reviewed" rollup badge next to the existing per-panel indicators.

### C. Optional polish

- When the last panel score is marked reviewed, update `video_submissions.status` to `complete` (today this only happens when the event itself closes).

## Technical notes

- Enum change is additive — no data backfill needed; existing events keep their current status.
- No new tables, no RLS changes. `judge_assignments` policies already restrict judge reads.
- Judge gating is enforced both in the UI (hide / disable) and on write (mutation refuses if event status is wrong) so it's safe even if a judge has a stale page open.
- `allReviewed` is derivable from the data `EventScoring` already fetches — no new queries.

## Out of scope

- Renaming `in_progress` (kept for compatibility with existing close-out trigger `set_submissions_complete_on_event_close`).
- Coach-portal changes — results publishing flow already documented separately.
