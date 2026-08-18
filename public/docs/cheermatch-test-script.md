# CheerMatch Scoring Portal - Manual Test Script

## How to use this script

- Purpose: a manual, end-to-end test script for the CheerMatch scoring portal. Work top to bottom, or run only the sections touched by a release.
- Environments: test on the preview URL before publishing, then repeat the smoke-critical cases (A1-A3, C2, G4, H6, I3, I6) on production.
- Accounts needed: one admin, two judges (one assigned to an SD/deductions panel), one gym coach with a phone, and one test organization.
- Recording results: mark each case Pass / Fail / Blocked, note the browser or device, and log a defect reference for every failure.

## A. Access, Roles & Authentication

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| A1 | Admin sign-in | Go to /auth, sign in with an admin account. | Redirected to /admin dashboard; sidebar shows Dashboard, Events, Scoring Rubrics, Submissions, Judge Broadcast, Settings. |  |  |
| A2 | Judge sign-in | Sign in with a judge account. | Redirected to /judge; judge sidebar and message bell visible; no admin routes reachable. |  |  |
| A3 | Coach sign-in | Sign in with a gym_coach account. | Redirected to /m (mobile coach app); only assigned events visible. |  |  |
| A4 | Invalid credentials | Attempt sign-in with a wrong password. | Clear error toast; no session created; no redirect. |  |  |
| A5 | Password reset | Use Forgot Password, open email link, set a new password. | Reset email received; new password works; old password rejected. |  |  |
| A6 | Admin-set password | Admin > Settings > User Roles > Edit user > set new password. Sign in as that user on web and mobile. | New password works on both web portal and mobile coach app. |  |  |
| A7 | Route protection | While signed out, open /admin, /judge and /m directly. | Redirected to sign-in; no protected data rendered. |  |  |
| A8 | Sign out | Click Log Out from the sidebar. | Session cleared; returned to sign-in; back button does not restore the portal. |  |  |

## B. Organizations & Users

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| B1 | Create organization | Settings > Organizations > add a new organization with name and contact details. | Organization saved and appears in the list. |  |  |
| B2 | Create user requires org | Settings > User Roles > Create User, leave Organization blank. | Validation blocks submit until an organization is selected. |  |  |
| B3 | Organization search | In Create/Edit user, type part of an organization name in the org box. | Combobox filters as you type; selection persists after save. |  |  |
| B4 | Role filters | On User Roles, use the search field and role filter chips (Admin / Judge / Coach). | Table filters correctly; counts match the visible rows. |  |  |
| B5 | Avatar upload | Edit a user, upload an avatar, save, then reload. | Avatar shows in the user table and in the sidebar for that user. |  |  |
| B6 | Delete user | Delete a test user. | User removed from list and can no longer sign in. |  |  |

## C. Events

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| C1 | Create event | Events > New Event: name, dates, scoring open date, template. | Event appears in the events table with status Registration Open. |  |  |
| C2 | Inline status change | Click the status badge in the events table and pick another status. | Status updates instantly and persists after refresh. |  |  |
| C3 | Status behaviour | Move an event through Registration Open > Open for Capture > Open for Scoring > Completed > Archived. | Capture allowed only from Open for Capture onward; judges can score in Open for Capture and Open for Scoring; Completed/Archived hide judge messages and lock scoring. |  |  |
| C4 | Event edit | Change event name/dates and save. | Changes reflected on dashboard tiles, judge dashboard, and mobile coach list. |  |  |
| C5 | Dashboard tiles | Open Admin Dashboard. | Current Events and Upcoming Events tiles list the right events; Currently Online shows active users; card icons are brand teal. |  |  |

## D. Registrations & CSV Import

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| D1 | Manual registration | Event > Registrations > Add Team with division, level and coach. | Team saved; Gym column auto-fills from the coach's organization. |  |  |
| D2 | Edit registration | Change a team's division and save. | Division updates in Registrations, Submissions, Scoring and Results views. |  |  |
| D3 | CSV import - clean file | Import a CSV where all organizations and coaches already exist. | All rows imported; summary counts match the file; no duplicates created. |  |  |
| D4 | CSV import - new org/coach | Import a CSV containing a new gym_name and a new coach email. | Organization auto-created; coach account auto-created and linked to that organization; team registered. |  |  |
| D5 | CSV import - bad data | Import a CSV with a missing division and a malformed email. | Row-level errors reported clearly; valid rows still import; invalid rows skipped. |  |  |
| D6 | Duplicate team name | Register two teams with the same name in one event. | System warns about duplicate names as designed. |  |  |

## E. Scoring Templates, Rubrics, Divisions

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| E1 | Create template | Settings > Scoring Templates > create a template with a discipline. | Template is created and grouped under the correct discipline tab; list shows one template per line. |  |  |
| E2 | Sections & fields | Add sections and numeric fields with max points. | Total available points updates correctly. |  |  |
| E3 | Difficulty Driver field | Add a Difficulty Driver field with skills and radio option values. | Judge sees radio options per skill; selected values sum into the field score. |  |  |
| E4 | Execution Driver field | Add an Execution Driver field with a start value and technique-issue reductions. | Score = start value minus selected reductions, never below zero. |  |  |
| E5 | Auto comments | As a judge, select technique issues on an Execution Driver field. | Comments box gains a bold + underlined field header and a bold line per issue: 'Issue: -value'. |  |  |
| E6 | Template locking | Set an event to Open for Scoring, then try to edit its template. | Template is locked; edits blocked with a clear message. |  |  |
| E7 | Divisions & Levels | Settings > Divisions & Levels: add, edit and filter by discipline. | All Star Cheer and All-Star Dance divisions/levels list correctly. |  |  |
| E8 | Scoring Rubrics | Upload a rubric with a discipline; open Scoring Rubrics menu in admin and judge sidebars. | Rubric listed with its discipline; All-Star Cheer link opens unitedscoringpartners.com in a new tab. |  |  |

## F. Judge Panels & Assignments

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| F1 | Create panels | Event > configure judge panels (e.g. B1, B2, SD). | Panels saved with their scoring responsibilities. |  |  |
| F2 | Assign panels dialog | Open Assign Panels; expand a division collapsible and assign judges to every section. | Green check icon appears on the division once fully assigned. |  |  |
| F3 | Bulk assignment | Use bulk judge assignment across multiple divisions. | Assignments applied; conflicts (same judge, same slot) are flagged. |  |  |
| F4 | Deductions judge | Assign a judge to the SD panel and open scoring as that judge. | SD judge sees only the deductions catalog, not other scoring sections. |  |  |

## G. Mobile Capture App (Coach)

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| G1 | Coach login | Open /m on a phone and sign in as a coach. | Assigned events list loads. |  |  |
| G2 | Team list | Tap an event. | Teams list with instruction text 'Tap the Team name below to record and submit their performance for Scoring.' |  |  |
| G3 | Record flow | Tap a team, then Record. Check portrait and landscape. | Start button floats centered over the viewport; buttons stack cleanly with no truncated text; audio meter works. |  |  |
| G4 | Upload | Record a short clip and submit. | Upload progress shown; submission status becomes Uploaded; video lands in a Brightcove folder named after the event. |  |  |
| G5 | Processing state | Open the submission immediately after upload in admin. | 'Video is still rendering' placeholder with Check again / Try playback anyway, not a Brightcove error. |  |  |
| G6 | Playback after render | Wait for Brightcove processing, reopen the submission and the coach's team detail screen. | Video plays in both places. |  |  |
| G7 | Deadline | Set a video submission deadline in the past and try to upload. | Deadline enforced/communicated as configured. |  |  |

## H. Judging

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| H1 | Judge dashboard | Sign in as a judge. | Assigned events grouped by event with 'Scoring opens <date>' or 'Scoring date TBD'. |  |  |
| H2 | Queue visibility | Check the scoring queue. | Only teams the judge is assigned to, in open events with a valid submission, are listed. |  |  |
| H3 | Score entry | Open a performance and enter scores using the +/- steppers. | Values change in the configured increments; running total shows points out of available points with no percentage. |  |  |
| H4 | Comment formatting | Use bold, italic, underline and spell check in the comments field. | Formatting markers applied and rendered on the scoresheet. |  |  |
| H5 | Save draft | Enter partial scores and Save Draft; leave and return. | Queue shows 'Draft Saved' with Resume Draft; values restored; admin sees draft status and can preview. |  |  |
| H6 | Submit scores | Submit a completed scoresheet. | Panel marked submitted; judge can no longer edit; admin sees submitted status. |  |  |
| H7 | Re-open for scoring | Admin re-opens the panel from the score review screen. | Panel returns to the judge's queue as a draft with prior scores intact; judge can edit and resubmit. |  |  |

## I. Admin Score Review & Results

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| I1 | Score review dialog | Event > Scoring > open a submission. | Assigned judge shown as a badge; per-panel scores listed; video player embedded. |  |  |
| I2 | Admin override | Override a field score to 0 with a reason. | Override recorded with reason; totals recalculated; override visible on review and scoresheet. |  |  |
| I3 | Score maths | Compare a submission's totals by hand. | total = (sum of field points / template max points) x 100, minus the SD judge's total deductions (% Perfection). Event score equals % Perfection. |  |  |
| I4 | Deductions | Enter a 0.15 deduction as the SD judge. | 0.15 is subtracted from the 100-point scale total, not averaged across judges. |  |  |
| I5 | Results publish | Publish results for an event. | Results become visible only after manual publish. |  |  |
| I6 | Scoresheet PDF | Download a scoresheet PDF for a fully scored team and a partially scored team. | All template criteria rows always shown; unscored rows blank/greyed with max points; difficulty + execution for the same criterion share one row with a combined total. |  |  |
| I7 | Ranking reports | Event > Reports: generate Overall, By Level, and per-Division rankings. | Rankings ordered by % Perfection to 4 decimals; ties handled; PDFs open cleanly. |  |  |
| I8 | Scoresheet email | Trigger scoresheet distribution once all panels submit. | Email sent with correct branding/logo and the right scoresheet attached. |  |  |

## J. Communication

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| J1 | Judge broadcast | Admin > Judge Broadcast: send a normal and an urgent message to an event's judges. | Teal banner for normal, red for urgent, appearing live for signed-in judges and on next login. |  |  |
| J2 | Message centre | Open the bell icon as a judge. | Unread badge count correct; messages listed; messages from Completed/Archived events hidden. |  |  |
| J3 | Coach review portal | Generate a review link and open it signed out. | Token URL loads the team's performances and scores read-only. |  |  |
| J4 | Bulk email | Use bulk email from Submissions to request videos or share review links. | Emails queued/sent to the right recipients with working links. |  |  |
| J5 | Email templates | Settings > Email templates: edit a template with variables and send a test. | Variables resolve; branding logo renders from the public asset bucket. |  |  |

## K. Settings, Branding & API

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| K1 | Branding | Settings > Branding: upload a logo and change the primary colour. | Logo appears in sidebars and emails; theme colour updates across the portal after refresh. |  |  |
| K2 | Video providers | Switch the active video provider and save credentials. | Setting persists; uploads route to the selected provider. |  |  |
| K3 | Mobile API access | Settings > Mobile API Access > View API Access. | Base URL and anon key shown; reveal/copy buttons work; example curl matches the live URL. |  |  |
| K4 | Test script download | Settings > Testing & QA: download the PDF, Markdown and CSV checklist. | All three files download and open correctly. |  |  |
| K5 | Notifications | Toggle notification settings and save. | Values persist after reload and drive the matching emails. |  |  |

## L. API Endpoints (developer smoke test)

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| L1 | /login | POST with apikey header and coach credentials. | 200 with a 64-character session token. |  |  |
| L2 | /me | GET with Authorization: Bearer <token>. | 200 with the coach profile and organization. |  |  |
| L3 | competitionList / mobile-coach-events | GET with a valid token. | Only events assigned to that coach returned. |  |  |
| L4 | mobile-coach-teams | GET for an event. | Teams owned by the coach (matched by coach_user_id or coach_email) returned. |  |  |
| L5 | brightcove-upload-init / -complete | Run an upload handshake for an email-matched coach. | Both calls succeed; no ownership rejection. |  |  |
| L6 | Unauthorised access | Call any endpoint with a missing or expired token. | 401 with a clear error body; no data leaked. |  |  |
| L7 | /logout | POST with a valid token, then reuse the token. | Token invalidated; subsequent calls return 401. |  |  |

## M. Cross-cutting & Regression

| ID | Test | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| M1 | Responsive layout | Check admin, judge and coach views at 375px, 768px and 1440px. | No overflow, unreadable text or clipped buttons. |  |  |
| M2 | Sidebar collapse | Collapse and expand the admin and judge sidebars. | Icon-only mode with tooltips; nested Events/Settings menus behave correctly. |  |  |
| M3 | Permissions | As a judge or coach, attempt to load an admin URL directly. | Access denied / redirect; no admin data returned. |  |  |
| M4 | Data integrity | Change a team's division after scores exist. | Scores and template association behave as expected; verify scoresheet still renders. |  |  |
| M5 | Console errors | Keep the browser console open through a full pass. | No uncaught errors or failed network requests. |  |  |
| M6 | Offline/slow network | Throttle the network during a mobile upload. | Graceful error and retry; no duplicate submissions. |  |  |
