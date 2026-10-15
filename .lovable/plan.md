# Judge Portal: Design Parity Review + Gap Fixes

## Answers to your questions

**Is the judge portal design kept up to date with admin?** Yes. The judge sidebar uses the exact same flat light-gray header band, logo + VIRTUAL wordmark, collapse toggle, and aligned divider as admin (the markup is identical in both files). Fonts, colors, the rubric links menu, and the broadcast/messages UI are all shared components, so design updates have carried over automatically.

**What judges can do today:**
- Dashboard: assigned events, in-progress and completed score counts, per-event "Score" buttons
- Scoring Queue: their assigned performances, filterable by pending / draft / scored
- Scoring screen: video player, score fields, deductions, Save Draft / Submit, rubric reference sheet
- Score History: their submitted scores (exists, but see gap 1)
- Rubrics: read-only browse/download
- Help: 7 judge-specific articles
- Broadcasts: banner + messages menu (same component admin uses)

## Gaps found

1. **Score History is unreachable** — the page exists at /judge/history but has no menu link.
2. **No judge Settings/profile page** — judges can't change their own password, upload an avatar, or set notification preferences. (The shared /reset-password page exists but nothing in the judge portal points to it.)
3. **Thinner Help** — 7 short topics vs admin's 11, and no downloadable manual like admin has.
4. **Minor header inconsistency** — the judge top bar arranges the collapse control, "Judge Portal" label, and messages icon in a different order than admin's.

## Proposed work

1. Add a **Score History** item to the judge menu (clipboard icon, between Scoring Queue and Rubrics).
2. Add a **judge Settings page** (`/judge/settings`) with:
   - Profile: full name + avatar upload (writes to the existing `profiles` row)
   - Security: change password (current password + new password, using the signed-in password change flow)
   - Menu entry in the judge sidebar footer area
3. Align the judge top bar with admin's layout (collapse control left, label, messages right).
4. Expand judge Help where gaps are obvious (Score History article, Settings/article for password change) — kept lightweight.

Not included (say the word if you want them): a downloadable judge manual PDF, notification preferences, or any change to scoring itself.

## Technical notes

- New files: `src/pages/judge/Settings.tsx`; edits to `JudgeSidebar.tsx`, `JudgeLayout.tsx`, `App.tsx`, `judge-topics.ts`.
- Avatar upload reuses the existing storage pattern; password change calls `supabase.auth.updateUser({ password, current_password })`.
- No database or backend changes needed.
