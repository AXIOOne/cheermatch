# AccuScore form preview (coach view)

Add a "preview as coach" view to the AccuScore → Forms management area, so you can see exactly how a form will look to a coach before saving or enabling it.

## What you'll get

- A **Preview** button (eye icon) on each form row in AccuScore → Forms. Clicking it opens a dialog showing the form rendered exactly as a coach sees it on their review page: form name, instructions, every question with its real input type (text, long text, number, timestamp, drop-down, radio, checkboxes, acknowledgment), required markers and help text, plus the submit button.
- A **live preview** inside the form editor: while editing a form, a "Preview" toggle shows the coach view of your unsaved changes side by side with the editor, so wording and option changes are visible immediately.
- The preview is interactive (you can click through the inputs) but never submits anything.

## Technical details

- Extract the field-rendering markup from `src/pages/review/ScoreReview.tsx` (lines ~176–231) into a shared component `src/components/accuscore/AccuScoreFormFields.tsx` that takes `fields`, `answers`, and an `onChange` setter. ScoreReview.tsx switches to using it, so the coach page and the preview can never drift apart.
- `src/components/admin/AccuScoreFormsManager.tsx`: add the per-row Preview button (opens a read-only-style dialog using the shared component) and the in-editor live preview toggle.
- No database or backend changes; no changes to how forms are saved or delivered to coaches.

## Verification

- Typecheck + build clean.
- Open AccuScore → Forms in the preview, click Preview on the Building Review Form, and confirm it matches the coach page rendering.
