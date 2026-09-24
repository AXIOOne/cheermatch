# Inline formatting for score comments

Replace the separate plain-text editor and preview with a single comment box that displays formatting while the judge types.

## Changes
- Turn the current comment box into an inline rich-text editor with Bold, Italic, Underline, and spell-check controls.
- Keep the existing saved comment format behind the scenes so previously formatted comments and PDF scoresheets remain compatible.
- Preserve formatting when an existing score is reopened instead of stripping it.
- Keep disabled/locked comment fields read-only.
- Verify both the judge scoring page and the administrator scoring dialog.

## Technical details
- Convert saved lightweight formatting markers to safe editor markup when loading, and serialize editor markup back to the existing marker format when saving.
- Support keyboard formatting shortcuts and selection-based toolbar actions in the editable box.
- Keep the browser and emailed scoresheet PDF renderers aligned for bold, italic, and underline.
