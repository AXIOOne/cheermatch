# AccuScore — score review requests

## What coaches get
- Every scoresheet email includes an **AccuScore** link unique to that team's submission.
- The link opens a page with gym, team, division, level and event already filled in, plus the team's video and scores.
- The coach picks one of the forms enabled for that event, fills it in, and submits. There's no limit on how many requests a team can send.
- The window opens when the scoresheet is sent and closes at the event's AccuScore cutoff. After the cutoff the page shows "Scores are final" and won't accept new requests.
- No fees.

## Event setup
- The event form gets a new **AccuScore** section:
  - Cutoff date/time (uses the event's existing cutoff field and the event's time zone).
  - Checkboxes for which AccuScore forms coaches can use at this event.

## Admin: AccuScore in the sidebar
- A new **AccuScore** menu item. It replaces the current Review Requests page and keeps any existing requests.
- **Open events**: one queue per event, with a count of new requests.
- **Closed folder**: queues for Completed and Archived events move here automatically.
- Each event queue has **New** and **Completed** tabs, showing team, gym, division, form type, when it was submitted, and status.

## Admin: reviewing a request
- The request window shows the coach's answers, the team details, and the video.
- An **Open Scoring** button opens the same score submission window used in the Scoring Control Panel, right inside the request. You can switch panels, change scores and use Admin Override with a reason there.
- Pick a decision (**Honored**, **Denied** or **Duplicate**), write a response to the coach, then click **Send Response**.
- Sending emails the coach your decision, your response, and an updated scoresheet PDF that reflects any score changes. The request then moves to Completed.

## Forms
- Forms are built from a shared form system: each form has a name, a description and its own fields (text, long text, time in routine, choice, and so on). Adding a form later doesn't require any change to the queues.
- **The first 4 forms will be built from the PDFs you upload.** Please attach them when you approve this plan, or right after. I'll match each PDF's questions and wording.

## Technical details
- New tables (with grants and RLS; admins have full access, coaches go through token-checked functions):
  - `accuscore_forms` (name, slug, description, `fields` jsonb, is_active)
  - `event_accuscore_forms` (event_id, form_id)
  - `accuscore_requests` (event_id, submission_id, team_id, form_id, token_id, answers jsonb, coach email/name, status `new|honored|denied|duplicate`, admin_response, responded_by/at, created_at)
- Use the existing `scoring_review_tokens` for each team's link. Create the token when the scoresheet email is sent (`send-scoresheet-email`) and add the link to the email. Set the token's expiry to the event's `accuscore_end_at`.
- Security-definer functions:
  - `get_accuscore_context(token)` returns team and event info, the enabled forms and whether the window is open.
  - `submit_accuscore_request(token, form_id, answers)` checks the cutoff on the server and rejects requests after it.
- Rework the public `/review/:token` page (`ScoreReview.tsx`) into the AccuScore form page.
- New pages: `/admin/accuscore` (open and closed event lists) and `/admin/accuscore/:eventId` (New/Completed queue plus the request window). The request window embeds `SubmissionScoringDialog`.
- New Edge Function `send-accuscore-response`. It builds the current scoresheet with the shared scoresheet PDF builder and emails the decision through Resend, the same way existing emails are sent. It also adds a default "AccuScore Response" email template that admins can edit.
- Copy existing `review_requested` tokens into `accuscore_requests` so they show up in the new queues.
- Add Help topics for AccuScore (admin side).
