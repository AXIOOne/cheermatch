# AccuScore: email link + multi-form submissions

## What changes for you
1. **AccuScore on/off per event** — a new "Enable AccuScore" switch in the event editor (next to the cutoff and form toggles). Existing events default to on.
2. **Scoresheet email** — the AccuScore link only appears when AccuScore is on for that event and it has at least one form enabled. Right beside the link the email shows **"Requests accepted until: {cutoff date & time, event time zone}"**. If no cutoff is set, it says "No cutoff set" (and you'll get a warning in the event editor to set one).
3. **Coach page** — instead of a single form dropdown, coaches see every enabled form as a card with a checkbox/"Fill out" toggle. They can open one, several, or all, fill each in, and press one **Submit** button.
4. **Separate requests** — each filled-in form is saved as its own request, so your AccuScore queue shows one row per form (e.g. Building and Tumbling from the same team = 2 requests, each answered on its own). Required questions are checked per selected form; nothing is saved unless all selected forms are valid. After submitting, the coach sees a confirmation listing each form sent, and the "past requests" list shows them individually.

## Technical details
- Migration: `events.accuscore_enabled boolean not null default true`.
- `get_accuscore_context` returns `accuscore_enabled`; `submit_accuscore_request` rejects when disabled (kept one-form-per-call; client calls it once per selected form, sequentially, reporting any failure per form).
- `send-scoresheet-email`: select `accuscore_enabled` + count of `event_accuscore_forms`; gate the link block; render cutoff next to the button in a two-column table cell layout. Redeploy.
- `ScoreReview.tsx`: replace `formId` state with `selectedFormIds: string[]` and `answersByForm: Record<formId, answers>`; render `AccuScoreFormFields` per selected form inside collapsible cards.
- Event editor (`Events.tsx`): add the switch; hide the form toggles when off.
