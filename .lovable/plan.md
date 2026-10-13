# Coach Welcome / Invite Email from Event Registrations

## What you'll get
On an event's Registrations tab, in the Coach Accounts list:
- A **Send welcome email** button on each coach row.
- A **Send welcome email to all** button at the top, with a confirmation that shows how many coaches will get it.
- A "Sent" date on each row after the email goes out, so you can see who already has one.

## How credentials work
Passwords are stored scrambled, so nobody can read a coach's current password, including the system. Each send does this:
- If the coach has no account yet, one is created automatically.
- A new temporary password is issued and put in the email, next to their username (their email address).
- Any password the coach had before stops working. The confirmation dialog will say so before you send.

## Email content (Coach Welcome / Invite)
1. A welcome message with the coach's name and the gym/organization they belong to (taken from their organization, or the gym name on their registration if they don't have one).
2. Login credentials: username and temporary password, plus a note to change the password after first login.
3. A button to download the iOS Capture App (apps.apple.com/kg/app/varsity-virtual-compete/id6800264562).
4. A "Request a TEST capture" section with a message about watching the training video. Until you send the real link, it shows as "coming soon" with no link. Adding the link later only means setting one value.
5. "Questions or need help? Contact support@cheermatch.com" with a clickable email link.

The live preview under Email Templates will show the new layout, and the custom subject setting keeps working. A new {{gymName}} placeholder will be available for the subject.

## Technical details
- `email-layouts.ts`: extend `coachWelcomeEmailHtml` with `gymName`, an app store button, a test-capture block (optional `testCaptureUrl`), and a support mailto. Add constants `IOS_CAPTURE_APP_URL` and `TEST_CAPTURE_URL` (empty for now).
- `invite-coach` edge function: accept `{ email, fullName, eventId }`, resolve the gym name (profile organization, falling back to teams.gym_name for that event), and pass it through to `send-welcome-email`. Record the send in `platform_settings`-style storage or a small `coach_invite_sends` table (event_id, coach_email, sent_at, sent_by), with RLS limited to admins.
- `CoachAccountsPanel.tsx`: per-row and bulk send buttons. Bulk sends call the function one coach at a time with progress shown, and report failures per coach.
- `built-in-emails.ts`: add `gymName` to the coach_welcome subjectVars.
- Deploy `invite-coach` and `send-welcome-email`, then check the preview and do one real send to a test coach.
