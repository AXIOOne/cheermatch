Rework the action column in the Scoring Control Panel (`src/pages/admin/EventScoring.tsx`).

## Primary button

Replace the green "Score" button with a green "Send Score Sheet" button.
- Same disabled rule as the existing menu item: only enabled once every panel is reviewed (`overallStatus.allReviewed`).
- Shows a spinner while sending.
- Clicking the button opens a confirmation `AlertDialog`: "Send score sheet to coach for {team name}? This will email the scoresheet immediately." with Cancel / Send actions. Sending only fires on confirm.
- Scoring stays reachable by clicking individual panel cells (as today). The "Score" button on the row goes away.

## 3-dot menu

Drop the "Send Score Sheet" entry from the menu. Keep only:
- **Preview** — opens a new `Dialog` that renders the scoresheet PDF for the current scores (whatever is filled in so far, even partial). Inside the dialog, build the PDF with `buildScoresheet` + `buildScoresheetPdf` (already used by `downloadSubmissionScoresheet`), turn the bytes into a blob URL, and show it in an `<iframe class="w-full h-[80vh]">`. Dialog has a Close button and a "Download PDF" button that reuses the same bytes. Loading state while the PDF is generating; revoke the blob URL when the dialog closes.
- **Download PDF** — unchanged behavior (calls `downloadSubmissionScoresheet`). Enabled regardless of review status so admins can grab a working draft (matches Preview's "current scores" behavior); if you'd rather keep the existing "all reviewed" gate, say so and I'll leave it.

## Technical notes

- Add `AlertDialog` import from `@/components/ui/alert-dialog` and `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` from `@/components/ui/dialog`.
- Track two new pieces of local state: `confirmSendFor: string | null` and `previewFor: { submissionId: string; teamName: string } | null`.
- Extract a small `generateScoresheetBytes(submissionId)` helper (or inline) by lifting the data-fetch + PDF-build logic out of `src/lib/download-submission-scoresheet.ts` into a sibling function that returns the `Uint8Array`, so Preview and Download can share it without re-downloading.
- No backend or schema changes.
