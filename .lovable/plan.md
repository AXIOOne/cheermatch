# Help & Documentation Section

Add an in-app Help center for admins and judges, plus a downloadable PDF manual.

## Navigation

- Admin sidebar: new **Help** item placed at the bottom of the menu list (below Settings, above the footer/user block), with a HelpCircle icon and collapsed-state tooltip.
- Judge sidebar: same **Help** item at the bottom of its menu list.
- Routes: `/admin/help` and `/admin/help/:topic`; `/judge/help` and `/judge/help/:topic`.

## Layout

Two-pane help page:

```text
+----------------------+--------------------------------------+
| Topic list (sticky)  |  Article body                        |
|  Getting Started     |   H1 title + summary                 |
|  Events              |   sections, steps, field tables      |
|  Registrations       |   callouts (note / warning / tip)    |
|  Scoring Control ... |                                      |
|  ...                 |   [Download full PDF manual]         |
+----------------------+--------------------------------------+
```

- Search box filters topics by title/keywords.
- Deep-linkable topics via URL slug; anchor links between related articles.
- Judge view renders only the judge-relevant subset from the same content source.
- All styling uses existing semantic tokens and shadcn Card/Tabs/Table components.

## Content (full reference depth)

Each article: purpose, step-by-step workflow, a field-by-field table where relevant, statuses, edge cases, troubleshooting.

Admin topics
1. Getting Started & Portal Overview — roles, navigation, portal areas.
2. Events — create/edit/update; every field explained (name, dates, discipline, status, scoring template, `scoring_open_at`, video submission deadline, etc.) and the downstream impact of each; the 5 statuses (Registration Open, Open for Capture, Open for Scoring, Completed, Archived) and what each unlocks.
3. Manage Registrations — manual add, coach/organization auto-fill of gym, CSV import (column reference, auto-created organizations and coach accounts), coach accounts panel, editing registrations.
4. Manage Submissions — submission lifecycle, video processing states, revision requests, review links, archive / restore / permanent delete with Brightcove cleanup and safeguards.
5. Scoring Control Panel — panel assignment grid, judge statuses (pending, draft saved, submitted), previewing drafts, admin score overrides with reason, re-open for scoring, deductions (SD) panel.
6. Event Results — % Perfection formula (raw points → percentage of template max, minus deductions), publishing results, scoresheet PDFs, scoresheet emails.
7. Ranking & Averages Reports — overall, by level, by division rankings; averages report format (`Difficulty | Execution`), ordering, PDF export behavior.
8. Scoring Templates & Judge Panels — sections and fields, field types including Difficulty Driver and Execution Driver, panel slots defined per template, template locking, deduction types.
9. Organizations & User Roles — creating users, role model, org assignment, avatars, coach passwords and resets.
10. Judge Broadcast — composing a blast, targeting judges on an event, how judges receive it live vs at login, read tracking.
11. Mobile Capture App & API — coach recording/upload flow, Brightcove event folders, and a pointer to the mobile API reference for developers.

Judge topics (subset, judge-worded)
- Getting Started for Judges
- Scoring Queue & Panel Assignments
- Scoring a Performance (field types, steps, auto comments)
- Save Draft & Resuming
- Deductions (SD) Panel
- Rubrics
- Broadcast Messages

## Downloadable PDF

- A generated **Portal Administrator Manual** PDF covering all admin topics, with cover page, table of contents, and one section per topic.
- Download button on the Help page header and a link in the existing Testing & QA card in Settings.
- Stored as a static file in `public/docs/` alongside the existing test script downloads.

## Technical notes

- Content lives in a typed content module (`src/content/help/*.ts`) exporting `{ slug, title, audience: 'admin' | 'judge' | 'both', keywords, sections[] }`, rendered by a shared `HelpArticle` component. No database, no backend changes.
- New files: `src/pages/admin/Help.tsx`, `src/pages/judge/Help.tsx`, `src/components/help/HelpLayout.tsx`, `src/components/help/HelpArticle.tsx`, `src/content/help/index.ts` plus per-topic content files.
- Edits: `src/App.tsx` (routes), `src/components/layout/AdminSidebar.tsx`, `src/components/layout/JudgeSidebar.tsx`, `src/pages/admin/Settings.tsx` (manual download link).
- PDF generated with the same jsPDF approach used by the existing report exports, written to `public/docs/cheermatch-admin-manual.pdf`.
