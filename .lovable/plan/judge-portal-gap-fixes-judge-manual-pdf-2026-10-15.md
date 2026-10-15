# Judge Portal: Gap Fixes + Judge Manual PDF

## Context (from the parity review)

The judge portal's design already matches admin — identical sidebar header band, logo + VIRTUAL wordmark, collapse toggle, shared rubric links and broadcast/messages UI. The gaps are functional: Score History has no menu link, judges have no settings/profile page, the judge top bar is arranged differently than admin's, and judge Help has no downloadable manual.

## Work items

1. **Score History menu link** — add to the judge sidebar between Scoring Queue and Rubrics (clipboard icon). The page at /judge/history already exists.

2. **Judge Settings page** (`/judge/settings`) with two cards:
   - Profile: full name + avatar upload (writes to the existing `profiles` row; avatar shown in the sidebar footer)
   - Security: change password — current password + new password, via `supabase.auth.updateUser({ password, current_password })`
   - Sidebar entry (Settings gear) above Log Out

3. **Align the judge top bar with admin** — collapse control left, "Judge Portal" label, messages menu right, matching AdminLayout's arrangement.

4. **Judge Help additions** — two short articles: Score History, and Settings & Password.

5. **Downloadable Judge Manual PDF** — generate `public/docs/cheermatch-judge-manual.pdf` covering all judge help topics (cover page, table of contents, one section per topic), matching the style of the existing admin manual. Add a "Download PDF manual" button to the judge Help page header (the `showManualDownload` prop already exists on HelpLayout — extend it to accept the judge manual path).

## Technical notes

- New files: `src/pages/judge/Settings.tsx`, `public/docs/cheermatch-judge-manual.pdf` (generated with reportlab, visually QA'd page by page).
- Edits: `JudgeSidebar.tsx`, `JudgeLayout.tsx`, `App.tsx` (route), `judge-topics.ts`, `HelpLayout.tsx` / `src/pages/judge/Help.tsx` (manual download button).
- No database or backend changes.
