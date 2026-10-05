# AccuScore form sections

Let admins split a form into named sections (e.g. Building Review -> "Difficulty" and "Execution"), each holding its own questions.

## What you'll see
- **Form editor:** an **Add section** button next to Add question. A section has a title and optional description. Questions placed below a section belong to it until the next section. Sections move up/down like questions (taking their questions along via a "Move section" control), and can be removed (questions stay, falling into the previous section).
- **Coach page and coach preview:** each section shows as a titled card/heading with its questions grouped underneath.
- **Request review (admin queue):** coach answers are grouped under the same section titles.
- Existing forms keep working unchanged (no sections = one flat list). Building Review gets no automatic split; you can add "Difficulty" and "Execution" yourself, or I can split it for you if you tell me which questions go where.

## Technical details
- No database change: forms stay a jsonb field list. Add a new item type `section` (`{ key, type: 'section', label, help }`) to `AccuScoreField`.
- `AccuScoreFormFields.tsx`: render `section` items as headings and group following fields; sections are never answered or required.
- `AccuScoreFormsManager.tsx`: "Add section" button, section row editor (title/description), section-aware move up/down and delete; type picker excludes section for normal questions.
- `ScoreReview.tsx` required-field validation and `AccuScoreEvent.tsx` answer display skip `section` items; display groups answers by section.
- `submit_accuscore_request` RPC unaffected (stores answers object only).
