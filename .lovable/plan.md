# Coach Testing Page

## What you'll get
A public page at **score.cheermatch.com/test-capture** (no login). The coach welcome email's "Request a TEST capture" section will link here and stop showing "coming soon".

The page has three steps:
1. **Download the iOS Capture App**: an App Store button.
2. **Watch the training video**: a video player. Until you give us the real video, it shows a "Training video coming soon" box. Adding the video later only means setting one link.
3. **Request a test submission**: the coach types their email and clicks "Request test".
   - If no coach account uses that email, they see: "We couldn't find a coach account with that email. Contact support@cheermatch.com."
   - If a coach account exists, a test registration is added for them under **CheerMatch TEST Event**. The page confirms it and tells them to open the Capture App, sign in, and record.
   - If they already have a test registration, it is not added again. The page says they're already set up.

## How the test registration looks
- Team name: "TEST – {gym name}", and the gym comes from the coach's organization.
- Coach: the coach's account, so the team shows up in their Capture App.
- Division: one fixed "test" division on the TEST event (the first active division unless you name one).
- It shows in the event's Registrations tab like any other team, so you can delete it later.

## Safety
- The coach only enters an email, and the check runs on the server. The page never shows any account details.
- Requests are rate-limited per email, so the page can't be used to flood the event or test which emails exist.

## Technical details
- New route `/test-capture` (public), page `src/pages/public/TestCapture.tsx`, using brand fonts and colors.
- New edge function `request-test-registration` with `verify_jwt` off. It validates the email with zod, checks the profile has the `gym_coach` role, finds the event by name "CheerMatch TEST Event 2026" (an id stored in `admin_settings` key `test_event_id` takes priority), and inserts the team with the service role only if no team already exists for that event and coach.
- `admin_settings` keys `test_event_id`, `test_division_id`, `training_video_url`, plus a small public-read RPC that returns only the video URL.
- `email-layouts.ts`: set `TEST_CAPTURE_URL` to the public page URL, then redeploy `send-welcome-email` and `invite-coach`.
- Verify the flow: an unknown email shows the error, a real coach email creates one team, and a repeat request adds nothing.

## Open items
- The training video link, which you'll send later.
- Which division the test team should use, if you want a specific one.
