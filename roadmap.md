# Roadmap

## Admin scoring assignments
- [x] Resolve judges and panel titles for the submission's division and level; refresh after assignment edits.
- [x] Verify UCA Virtual's Elliott County pop-up and panel switching at desktop and 873px width; six assignment regression tests passed.

## Registered-team export
- [x] Add CSV export with current video status, respecting table search and sorting.
- [x] Verify status tests and signed-in download with real registrations: 13 tests passed; 102-team full export and 2-team searched export match table statuses and division order.

## Monitoring review
- [x] Verify all 12 findings: 8 confirmed, 3 stale, 1 intentional whole-panel admin override.
- [x] Fix scoring input loops/validation and comment line breaks; browser regressions and tests passed.
- [x] Fix email receipts, admin provenance for judge lockout, coach performance display, offline footage retention, and manual-upload retry eligibility.
- [x] Validate changes: 33 tests passed, preview builds clean, signed-in scoring dialog opens with live video and no page errors.
- Live email delivery and coach review with real scores remain unexercised: no existing submitted scores or review tokens; no production scores/emails were created for testing.

## Done
- Compact registered teams table with gray capture-started, yellow awaiting-approval, and green approved rows; status tests passed and live gray/green rows, search, edit, and narrow-screen layout verified.
- Judge portal gap fixes: judge Settings page (profile + avatar + password change), judge top bar aligned with admin, judge Help articles, downloadable judge manual PDF with Help download button.

## Open / blocked
- Training video link pending (admin_settings key training_video_url)
- Test division stand-in (Junior Coed Level 1) — user may name a specific one
- "Password Protection Disabled" security warning unresolved
- Score History hidden from judges (for now): nav link, route, help article and manual section removed; src/pages/judge/ScoreHistory.tsx kept so it can be restored on request
- Chrome error report not reproduced (awaiting exact error/screenshot)
