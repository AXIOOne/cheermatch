# Hide panels that have no fields in a submission's scoring template

## Goal

When a scoring template (e.g. the Novice scoresheet) has no fields tagged for a panel like B1 or T1, that panel should not appear for submissions using that template — no assignment row in Assign Panels, no status square in the Scoring Control Panel, and no chip in the score submission dialog.

## Current behavior (confirmed)

- Judge panels (B1, B2, T1, T2, Overall, SD) are defined **per event**, so they exist for every division even when a division's template has no fields for them.
- The Assign Panels dialog lists every section of each division's template, including sections whose fields are all tagged for other panels.
- The Scoring Control Panel and the score submission dialog show **all** event panels for every submission, and a submission only counts as "complete" when every event panel has a submitted score — so novice submissions can never reach complete when B1/T1 have no fields.
- The judges' Scoring Queue already hides submissions when the judge's panel has no fields in that template, so judges are unaffected.

## Changes

1. **Assign Panels dialog** (`AssignPanelsDialog.tsx`)
   - Load field counts (and their panel tags) per template section.
   - Hide sections that contain no fields at all, and hide sections whose fields are all tagged for panels other than the section's own panel.
   - Keep the SD / deductions row always (deductions are not template fields).

2. **Scoring Control Panel** (`EventScoring.tsx`)
   - For each submission, compute the panels that actually have fields in that submission's template (plus SD, which is always kept).
   - The per-submission status squares and the "complete / reviewed" logic only consider those relevant panels, so a novice submission is complete once its real panels are scored.

3. **Score submission dialog** (`SubmissionScoringDialog.tsx`)
   - Filter the panel chips at the top the same way: only panels with fields in the submission's template (plus SD) are shown and selectable.

4. **Shared helper** (`src/lib/scoring.ts`)
   - Add one helper (e.g. `panelsForTemplate(template, panels)`) used by all three places so the rule lives in one spot.

## Effect on other scoring templates

- None. The filtering is per submission and per template: templates that **do** have B1/T1 fields keep showing those panels exactly as today. SD/deductions panels are always kept on every event. No data is deleted — existing B1/T1 assignments and scores stay in the database and reappear if fields are ever tagged for those panels.

## Verification

- Open Assign Panels for All-Star Elite TEST Event 2026: novice divisions no longer show B1/T1 rows; other divisions unchanged.
- Open the Scoring Control Panel: novice submissions show only their relevant panel squares and can reach "complete".
- Open a novice submission's score dialog: only relevant panel chips appear; a non-novice submission still shows all panels.
