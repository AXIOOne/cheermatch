import type { HelpTopic } from './types';

export const adminTopics: HelpTopic[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started & Portal Overview',
    summary: 'How the portal is organised, who can access what, and the typical lifecycle of an event.',
    audience: 'admin',
    keywords: ['overview', 'roles', 'navigation', 'start', 'introduction'],
    blocks: [
      { type: 'p', text: 'The portal runs competition scoring end to end: registrations come in, coaches capture performance video on the mobile app, assigned judges score against a scoring template, and administrators publish results and reports.' },
      { type: 'heading', text: 'Roles' },
      {
        type: 'table',
        head: ['Role', 'Where they work', 'What they can do'],
        rows: [
          ['Administrator', 'Admin portal (/admin)', 'Everything: events, registrations, templates, panels, submissions, scoring control, results, reports, users.'],
          ['Judge', 'Judge portal (/judge)', 'See assigned events, score their panel assignments, save drafts, read broadcast messages, open rubrics.'],
          ['Gym / Coach', 'Mobile capture app (/m)', 'See their teams for an event, record and upload performance video, view review links when shared.'],
        ],
      },
      { type: 'callout', variant: 'note', text: 'There is no public sign-up. Every account is created by an administrator, or automatically during CSV registration import for coaches.' },
      { type: 'heading', text: 'The lifecycle of an event' },
      {
        type: 'steps',
        items: [
          'Create the event and pick its discipline and scoring template.',
          'Add team registrations manually or by CSV import (organizations and coach accounts are created automatically when missing).',
          'Move the event to Open for Capture so coaches can record and upload video.',
          'Assign judges to the panel slots defined by the scoring template.',
          'Move the event to Open for Scoring; judges work through their queue and submit scores.',
          'Review scores in the Scoring Control Panel, apply overrides or re-open panels as needed.',
          'Publish results, email scoresheets, and export ranking and averages reports.',
          'Mark the event Completed, then Archived once everything is distributed.',
        ],
      },
      { type: 'heading', text: 'Navigation' },
      {
        type: 'bullets',
        items: [
          'Dashboard — current and upcoming events, recent logins, who is online.',
          'Events — event list plus per-event Registrations, Scoring, Results, Participants and Reports.',
          'Rubrics — links to the published rubric for each discipline.',
          'Submissions — every video submission across all events, including the Archived tab.',
          'Judge Broadcast — send messages to judges assigned to an event.',
          'Settings — general settings, branding, scoring templates, divisions & levels, organizations, user roles.',
          'Help — this documentation.',
        ],
      },
    ],
  },

  {
    slug: 'events',
    title: 'Events: Create, Edit and Update',
    summary: 'Every event field explained, what it controls downstream, and what each status unlocks.',
    audience: 'admin',
    keywords: ['event', 'create event', 'status', 'dates', 'deadline', 'scoring template'],
    blocks: [
      { type: 'heading', text: 'Creating an event' },
      {
        type: 'steps',
        items: [
          'Go to Events and choose New Event.',
          'Enter the name, discipline, dates and location.',
          'Choose the default scoring template for the event.',
          'Set the scoring open date and the video submission deadline.',
          'Save. The event starts in Registration Open.',
        ],
      },
      { type: 'heading', text: 'Field reference' },
      {
        type: 'table',
        head: ['Field', 'What it does downstream'],
        rows: [
          ['Name', 'Shown everywhere: judge dashboard, coach app, scoresheets, report headers, and used as the Brightcove upload folder name for video captured on the mobile app.'],
          ['Discipline', 'Filters which scoring templates and rubrics can be selected for the event and its divisions.'],
          ['Start / end date', 'Drives the Current Events and Upcoming Events tiles on the dashboard and the ordering of event lists.'],
          ['Location', 'Display only — appears on event cards and report headers.'],
          ['Scoring template', 'The fallback template used to score any team in the event. Resolution order is: team score template → division template → event template → global default. It also defines the maximum points used for the % Perfection conversion.'],
          ['Scoring opens (date/time)', 'Shown to judges on their dashboard as “Scoring opens …”. Informational for judges; actual access is controlled by the event status.'],
          ['Video submission deadline', 'Date shown to coaches in the mobile app and used by admins to chase missing submissions.'],
          ['Status', 'The main control switch — see the table below.'],
        ],
      },
      { type: 'heading', text: 'Statuses' },
      {
        type: 'table',
        head: ['Status', 'What it unlocks'],
        rows: [
          ['Registration Open', 'Teams can be added or imported. Coaches cannot capture yet; judges see no queue.'],
          ['Open for Capture', 'Coaches see the event in the mobile app and can record and upload performance video. Judges can begin working if assignments exist.'],
          ['Open for Scoring', 'Judges see the event and their queue. Capture remains available so late submissions still flow through.'],
          ['Completed', 'Scoring is finished. Use for published results and report distribution; the event drops off the “current” dashboard tile.'],
          ['Archived', 'Historical record. Hidden from active lists; data and reports remain available.'],
        ],
      },
      { type: 'callout', variant: 'warning', title: 'Changing the template mid-event', text: 'Changing the event scoring template after judges have submitted scores changes the maximum points used in the % Perfection calculation. Only do this before scoring begins, or re-open and re-score affected panels.' },
      { type: 'heading', text: 'Editing and updating' },
      {
        type: 'bullets',
        items: [
          'Edit an event from the Events list — all fields except historic scores can be changed at any time.',
          'Moving an event backwards in status (for example Completed → Open for Scoring) re-opens judge access; use it when a late correction is needed.',
          'Registrations, judge assignments, submissions and scores all stay attached to the event through status changes.',
        ],
      },
    ],
  },

  {
    slug: 'registrations',
    title: 'Manage Registrations',
    summary: 'Adding teams manually, importing by CSV, and how organizations and coach accounts are created automatically.',
    audience: 'admin',
    keywords: ['registration', 'teams', 'csv', 'import', 'coach', 'gym', 'organization'],
    blocks: [
      { type: 'p', text: 'Open an event and choose Registrations. Every team competing must exist here before it can be captured, judged or ranked.' },
      { type: 'heading', text: 'Adding a team manually' },
      {
        type: 'steps',
        items: [
          'Click Add Registration.',
          'Select the coach. The gym is filled in automatically from the coach’s assigned organization.',
          'Enter the team name, division and level.',
          'Enter athlete counts (female / male) — these appear on the registration table and participant reports.',
          'Save. The team immediately becomes visible to the coach in the mobile app once the event is Open for Capture.',
        ],
      },
      { type: 'heading', text: 'CSV import' },
      { type: 'p', text: 'Use Import CSV for bulk registration. The importer creates anything that is missing rather than failing the row.' },
      {
        type: 'table',
        head: ['Column', 'Notes'],
        rows: [
          ['team_name', 'Required. Must be unique within the event.'],
          ['gym_name', 'Required. Matched to an existing organization by name; created as a new organization if it does not exist.'],
          ['division', 'Matched by name against the event discipline’s divisions.'],
          ['level', 'Matched by name against the configured levels.'],
          ['coach_name', 'Used for the coach account display name.'],
          ['coach_email', 'Required for coach access. An account is created if none exists and assigned to the gym’s organization.'],
          ['athletes_female / athletes_male', 'Optional numeric counts.'],
        ],
      },
      {
        type: 'bullets',
        items: [
          'Organizations that appear in gym_name but do not exist are created automatically.',
          'Coach accounts that do not exist are created and linked to that organization, with credentials synced so the mobile app login works.',
          'Rows are validated before import; you get a preview with any problems highlighted so you can fix the file and retry.',
        ],
      },
      { type: 'heading', text: 'Coach accounts panel' },
      { type: 'p', text: 'Below the registration table, the Coach Accounts panel lists every coach attached to the event and whether they have a working account. From here you can create a missing account, resend the invite, or reset a password if a coach cannot sign in to the capture app.' },
      { type: 'callout', variant: 'tip', text: 'If a coach reports that they cannot see their teams, check three things: the event status is Open for Capture, the team’s coach is the right account, and the coach account exists in this panel.' },
    ],
  },

  {
    slug: 'submissions',
    title: 'Manage Submissions',
    summary: 'The submission lifecycle, video processing states, revisions, review links, and archive / restore / delete.',
    audience: 'admin',
    keywords: ['submissions', 'video', 'archive', 'delete', 'brightcove', 'revision', 'review link'],
    blocks: [
      { type: 'p', text: 'The Submissions area lists every performance video across all events. Open an event’s Scoring page for the event-only view, or use the global Submissions page to work across events.' },
      { type: 'heading', text: 'Lifecycle' },
      {
        type: 'table',
        head: ['State', 'Meaning'],
        rows: [
          ['Pending', 'Registered team with no video uploaded yet.'],
          ['Processing', 'Video uploaded and still rendering on the video host. Playback shows a “still rendering” placeholder with a refresh action.'],
          ['Ready', 'Video is playable and available to assigned judges.'],
          ['In review / scored', 'One or more judge panels have submitted scores.'],
          ['Revision requested', 'Admin asked the coach for a new upload; the coach is emailed and can re-capture.'],
          ['Archived', 'Moved out of the active list into the Archived tab.'],
        ],
      },
      { type: 'heading', text: 'Working with a submission' },
      {
        type: 'bullets',
        items: [
          'Open a submission to watch the video, see each panel’s score status, and download the scoresheet PDF.',
          'Request a revision to email the coach and ask for a re-upload.',
          'Generate a review link to give the coach a token-based page showing their performance and score breakdown, without needing a login.',
        ],
      },
      { type: 'heading', text: 'Archive, restore and delete' },
      {
        type: 'steps',
        items: [
          'Archive moves the submission to the Archived tab and remembers its previous status.',
          'Restore from the Archived tab returns it to the active list with the status it had before archiving.',
          'Delete permanently removes the submission and its video from the video host. This requires an explicit confirmation and cannot be undone.',
        ],
      },
      { type: 'callout', variant: 'warning', title: 'Deletion is permanent', text: 'Permanent delete also removes the asset from Brightcove. Archive first if there is any chance you will need the footage again.' },
    ],
  },

  {
    slug: 'scoring-control-panel',
    title: 'Scoring Control Panel',
    summary: 'Judge assignments, panel statuses, draft previews, admin overrides and re-opening scoring.',
    audience: 'admin',
    keywords: ['scoring', 'panel', 'judge', 'draft', 'override', 're-open', 'deductions'],
    blocks: [
      { type: 'p', text: 'Open an event and choose Scoring. This is the control room: one row per team, one column per panel slot, showing exactly where every score stands.' },
      { type: 'heading', text: 'Assigning judges' },
      {
        type: 'bullets',
        items: [
          'Use Assign Panels to fill each panel slot per division. Divisions are collapsible and show a green check once every slot is assigned.',
          'Panel slots (for example B1, B2, T1, OV, SD, or J1…Jn) come from the scoring template attached to the event, so they always match the scoresheet.',
          'Bulk judge assignment applies a judge across many divisions at once and flags conflicts.',
          'A judge assigned to two slots for the same team scores each slot separately — they appear as two cards in the judge’s queue.',
        ],
      },
      { type: 'heading', text: 'Panel status indicators' },
      {
        type: 'table',
        head: ['Indicator', 'Meaning'],
        rows: [
          ['Pending', 'Assigned but not started.'],
          ['Draft saved', 'Judge saved partial work; the score is not final. Admins can preview the draft.'],
          ['Submitted', 'Judge finalised the score; it counts toward results.'],
          ['Overridden', 'An admin zeroed one or more fields with a recorded reason.'],
        ],
      },
      { type: 'heading', text: 'Admin actions on a submission' },
      {
        type: 'bullets',
        items: [
          'Preview draft — see what a judge has entered so far without changing it.',
          'Override a field to zero — requires a reason, which is stored with the score for audit.',
          'Re-open for scoring — returns the panel to the judge’s queue as a draft with their entries preserved, so they can correct and re-submit.',
        ],
      },
      { type: 'heading', text: 'Deductions' },
      { type: 'p', text: 'Deductions are a separate panel assignment (SD). The judge holding that slot sees only the deductions catalogue, and their total is subtracted from the converted percentage score. Other judges do not see deduction controls.' },
      { type: 'callout', variant: 'note', text: 'Individual judge percentages are intentionally hidden. Each judge sees points scored out of points available; percentage only applies once the whole panel is combined.' },
    ],
  },

  {
    slug: 'event-results',
    title: 'Event Results',
    summary: 'How the final score is calculated, publishing results, and distributing scoresheets.',
    audience: 'admin',
    keywords: ['results', 'perfection', 'score', 'publish', 'scoresheet', 'email'],
    blocks: [
      { type: 'heading', text: 'How the score is calculated' },
      {
        type: 'steps',
        items: [
          'Raw score = the sum of all points earned across the scoresheet.',
          'Converted score = (raw score ÷ total points possible on the scoring template) × 100.',
          'Total score (% Perfection) = converted score − total deductions.',
          'The event score shown in results and rankings is the same % Perfection value.',
        ],
      },
      { type: 'callout', variant: 'note', text: 'Deductions are always removed after conversion, so a 0.15 deduction removes 0.15 from the 100-point scale — not from the raw points.' },
      { type: 'heading', text: 'Publishing' },
      {
        type: 'bullets',
        items: [
          'Results are published manually. Nothing is visible to coaches until an administrator publishes.',
          'Publish only after every panel shows Submitted, otherwise partially scored teams appear low in the rankings.',
          'Scoresheet PDFs show every criterion row from the template, blank or zero where nothing was scored, always out of the template’s available points.',
          'Criteria with the same name that carry both a difficulty and an execution input print on one line, with the combined total in the right-hand column.',
        ],
      },
      { type: 'heading', text: 'Scoresheet distribution' },
      { type: 'p', text: 'Once all judge panels for a submission have submitted, the score breakdown can be emailed to the coach automatically, and the same breakdown is available on the coach review link.' },
    ],
  },

  {
    slug: 'reports',
    title: 'Ranking & Averages Reports',
    summary: 'Overall, level and division rankings plus the division averages report and its PDF export.',
    audience: 'admin',
    keywords: ['reports', 'ranking', 'averages', 'pdf', 'division', 'level'],
    blocks: [
      { type: 'p', text: 'Open an event and choose Results or Reports. All reports rank on % Perfection with four-decimal precision, so ties are broken accurately.' },
      {
        type: 'table',
        head: ['Report', 'Contents'],
        rows: [
          ['Overall rankings', 'Every team in the event ranked from highest score down.'],
          ['Rankings by level', 'Teams grouped by level, ranked within each group.'],
          ['Division rankings', 'One ranking table per division.'],
          ['Division averages', 'Per-division table of average criterion scores across the panel.'],
        ],
      },
      { type: 'heading', text: 'Averages report format' },
      {
        type: 'bullets',
        items: [
          'Each criterion is one column. Criteria that have both a difficulty and an execution input print as “Difficulty | Execution”, for example 4.5 | 3.8.',
          'Rows are ordered by ranking with the first-place team at the bottom of the table.',
          'The table is fully gridded on screen and in the PDF.',
          'The PDF is landscape and starts a new page for each division, with columns scaled so every criterion fits on one page width.',
        ],
      },
      { type: 'callout', variant: 'tip', text: 'Export reports after every panel has submitted. Draft scores are excluded from report totals.' },
    ],
  },

  {
    slug: 'scoring-templates',
    title: 'Scoring Templates & Judge Panels',
    summary: 'Building scoresheets: sections, field types, judge panel slots, deduction types and locking.',
    audience: 'admin',
    keywords: ['template', 'scoresheet', 'field', 'difficulty driver', 'execution driver', 'panels', 'lock'],
    blocks: [
      { type: 'p', text: 'Settings → Scoring Templates. Templates are grouped by discipline and define both the scoresheet and the panel slots used for judge assignment.' },
      { type: 'heading', text: 'Structure' },
      {
        type: 'bullets',
        items: [
          'A template has sections; each section has criteria (fields).',
          'Each field carries a maximum point value and the panel slot(s) that score it.',
          'Only leaf criteria are scored — parent categories total their children.',
          'The sum of every field’s maximum is the template max used for the % Perfection conversion.',
        ],
      },
      { type: 'heading', text: 'Field types' },
      {
        type: 'table',
        head: ['Type', 'Behaviour'],
        rows: [
          ['Numeric score', 'A value entered with + / − steppers, typically in 0.5 increments up to the field maximum.'],
          ['Difficulty driver', 'Contains named skills, each with radio-button values. The field score is the sum of the selected values.'],
          ['Execution driver', 'Has a pre-set start value. Selecting technique issues subtracts their reduction values: score = max(0, start value − sum of reductions). Each selection also writes a line into Comments & Feedback in the form “technique issue: point value removed”.'],
        ],
      },
      { type: 'heading', text: 'Judge panels' },
      {
        type: 'bullets',
        items: [
          'Each template has a Judge Panels tab defining its slots — an All Star preset, numbered J1…Jn, or custom abbreviations.',
          'Field builder chips come from this list, and stale abbreviations are flagged.',
          'An event’s judge panels can be seeded directly from the template so assignments always match the scoresheet.',
        ],
      },
      { type: 'heading', text: 'Deduction types and locking' },
      {
        type: 'bullets',
        items: [
          'Deduction types are configured per template and shown only to the judge holding the deductions (SD) slot.',
          'Templates lock manually, or automatically when an event moves into scoring, to prevent the maximum points changing under live scores.',
        ],
      },
      { type: 'callout', variant: 'warning', text: 'Editing a template that is already in use changes the maximum points and therefore every % Perfection score derived from it. Duplicate the template instead when a season’s rules change.' },
    ],
  },

  {
    slug: 'organizations-users',
    title: 'Organizations & User Roles',
    summary: 'Creating accounts, assigning roles and organizations, avatars and coach passwords.',
    audience: 'admin',
    keywords: ['users', 'roles', 'organization', 'gym', 'password', 'avatar', 'admin', 'judge'],
    blocks: [
      { type: 'heading', text: 'Organizations' },
      { type: 'p', text: 'Settings → Organizations holds every gym or program. Users are assigned to an organization, and a team registration inherits its gym from the assigned coach’s organization, so gym names stay consistent across events and reports.' },
      { type: 'heading', text: 'Users and roles' },
      {
        type: 'steps',
        items: [
          'Go to Settings → User Roles.',
          'Add a user with name, email and role (Administrator, Judge, or Gym / Coach).',
          'Assign the organization — required for coaches so registrations can pull the gym.',
          'Optionally upload an avatar; it appears in the sidebar, the dashboard online list and user tables.',
          'Save. The user receives an invite email; you can resend it at any time.',
        ],
      },
      {
        type: 'bullets',
        items: [
          'Roles are stored separately from profiles and control which portal a user lands in after login.',
          'Changing a coach’s password from the edit dialog also syncs the credential used by the mobile capture app.',
          'The dashboard shows recent logins for the last 30 days so you can confirm a user actually signed in.',
        ],
      },
      { type: 'callout', variant: 'note', text: 'Registration fees and payments are handled outside the portal. There is no payment processing here by design.' },
    ],
  },

  {
    slug: 'judge-broadcast',
    title: 'Using the Judge Broadcast Feature',
    summary: 'Sending messages to the judges working an event and how they receive them.',
    audience: 'admin',
    keywords: ['broadcast', 'message', 'judges', 'announcement', 'notification'],
    blocks: [
      { type: 'p', text: 'Judge Broadcast sends an announcement to every judge assigned to a chosen event — for example a schedule change, a rules clarification, or a break announcement.' },
      { type: 'heading', text: 'Sending a message' },
      {
        type: 'steps',
        items: [
          'Open Judge Broadcast from the sidebar.',
          'Select the event. Recipients are the judges assigned to that event’s panels.',
          'Write the message title and body.',
          'Send. The message goes out immediately.',
        ],
      },
      { type: 'heading', text: 'How judges receive it' },
      {
        type: 'bullets',
        items: [
          'Judges who are logged in see it drop down from the top of the screen straight away.',
          'Judges who are not logged in see it the next time they sign in.',
          'Judges can dismiss a message; the dismissal is recorded so you can see who has read what.',
          'Past messages remain visible in the judge’s messages menu.',
        ],
      },
      { type: 'callout', variant: 'tip', text: 'Keep broadcasts short and specific — they interrupt judges mid-scoring. For anything long, send a message pointing to a document instead.' },
    ],
  },

  {
    slug: 'mobile-app-api',
    title: 'Mobile Capture App & API',
    summary: 'How coaches record and upload, and where developers find the API reference.',
    audience: 'admin',
    keywords: ['mobile', 'capture', 'coach', 'video', 'upload', 'api', 'brightcove'],
    blocks: [
      { type: 'heading', text: 'Coach capture flow' },
      {
        type: 'steps',
        items: [
          'The coach signs in to the mobile app with their portal account.',
          'They see the events they have teams in, once each event is Open for Capture.',
          'They tap the team name to open the capture screen.',
          'They record using the centred Start control, review the take, and submit.',
          'The video uploads to the video host into a folder named after the event, then renders before it becomes playable for judges.',
        ],
      },
      { type: 'heading', text: 'Common issues' },
      {
        type: 'table',
        head: ['Symptom', 'Cause / fix'],
        rows: [
          ['Coach sees no events', 'Event is not Open for Capture, or the coach is not the assigned coach on any team.'],
          ['Coach cannot log in', 'Reset the password from Settings → User Roles, which also syncs the mobile credential.'],
          ['Video shows “still rendering”', 'Normal — the host is still transcoding. Use the refresh action; large files can take several minutes.'],
          ['Upload rejected', 'Confirm the coach account is linked to the team and to an organization.'],
        ],
      },
      { type: 'heading', text: 'For developers' },
      { type: 'p', text: 'The portal exposes a REST API for mobile clients. Authentication is two layers: the public project API key header, plus a session bearer token returned by the login endpoint. The full endpoint reference is maintained as a separate document for the mobile team.' },
    ],
  },
];
