import type { HelpTopic } from './types';

const J = '/help/judge';

export const judgeTopics: HelpTopic[] = [
  {
    slug: 'judge-getting-started',
    title: 'Getting Started for Judges',
    summary: 'What you see when you sign in and how the judge portal is organised.',
    audience: 'judge',
    keywords: ['judge', 'start', 'dashboard', 'events', 'menu'],
    blocks: [
      { type: 'p', text: 'Your dashboard shows the events you are assigned to, how many scores are in progress and completed, and when scoring opens for each event. Click Start Scoring or the Score button next to an event to go straight to your queue.' },
      { type: 'image', src: `${J}/dashboard.webp`, alt: 'Judge dashboard with assigned events and score counts', caption: 'The judge dashboard. Completed counts only the scores still visible in your queue.' },
      { type: 'heading', text: 'The side menu' },
      {
        type: 'bullets',
        items: [
          'Dashboard — your assigned events, in-progress and completed counts.',
          'Scoring Queue — every team waiting for your score.',
          'Scoring Rubrics — opens the published rubric for each discipline in a new tab.',
          'Help — this guide, plus the downloadable PDF judge manual.',
          'Settings (bottom of the menu) — your name, photo and password.',
          'The bell at the top right shows messages from the event administrator.',
        ],
      },
      { type: 'callout', variant: 'note', text: 'If an event is missing, the administrator has not opened it for scoring yet or has not assigned you to a panel. Contact the event administrator.' },
    ],
  },
  {
    slug: 'judge-queue',
    title: 'Scoring Queue & Panel Assignments',
    summary: 'How your queue is built and what happens when you hold more than one panel.',
    audience: 'judge',
    keywords: ['queue', 'panel', 'assignment', 'teams', 'filter'],
    blocks: [
      { type: 'p', text: 'The queue shows one card per panel assignment. If you hold two panels for the same team (for example B1 and B2), you get two cards and score each one separately.' },
      { type: 'image', src: `${J}/queue.webp`, alt: 'Scoring queue with team cards and Score buttons', caption: 'Each card shows the team, gym, event, division, level and your panel.' },
      {
        type: 'bullets',
        items: [
          'Use the filters at the top to switch between Pending and Completed, and to pick an event.',
          'A card appears only once the team’s video has been approved by the administrator.',
          'Cards with a saved draft can be reopened and continued.',
          'A card that comes back after you submitted it has been reopened by the administrator for a correction. Your earlier entries are kept.',
        ],
      },
    ],
  },
  {
    slug: 'judge-scoring',
    title: 'Scoring a Performance',
    summary: 'The scoring screen, field types, saving, submitting and flagging.',
    audience: 'judge',
    keywords: ['scoring', 'score', 'difficulty', 'execution', 'comments', 'submit', 'flag', 'minimum'],
    blocks: [
      { type: 'video', src: `${J}/judge-scoring.mp4`, poster: `${J}/judge-scoring-poster.webp`, caption: 'Walkthrough: open a team from the queue, enter scores, check the rubric and open Score Tracking (36 sec).' },
      { type: 'heading', text: 'The scoring screen' },
      { type: 'image', src: `${J}/scoring.webp`, alt: 'Judge scoring screen with video on the left and score fields on the right', caption: 'Team details across the top, the video on the left, your score fields on the right and comments below.' },
      {
        type: 'steps',
        items: [
          'Open a card from your queue. Check the team details in the band across the top.',
          'Play the video. Use Replay to watch it again.',
          'Work down the score fields on the right. The list scrolls inside the box so it stays level with the video.',
          'Add notes for the coach in Judge Comments. Bold, italic, underline and colour are available.',
          'Click Save Draft to pause, or Submit Score when you are finished.',
        ],
      },
      { type: 'heading', text: 'Field types' },
      {
        type: 'table',
        head: ['Type', 'How to score it'],
        rows: [
          ['Drop-down score', 'Pick the value from the list. Values follow the field’s allowed range.'],
          ['Numeric score', 'Type or step the value, usually in 0.5 increments, up to the field maximum.'],
          ['Skill selections', 'Choose one option per listed skill (for example N/A, Advanced by MOST, Elite by MOST). The field total adds up what you selected.'],
          ['Execution with reductions', 'The field starts at a set value. Each technique issue you tick takes points off; it never goes below zero, and a line is added to your comments automatically.'],
        ],
      },
      { type: 'callout', variant: 'note', title: 'Minimum scores', text: 'Some fields have a required minimum. Until every such field is scored, Submit Score is disabled and a red note at the top tells you how many fields still need attention.' },
      { type: 'heading', text: 'Submit & Flag' },
      { type: 'p', text: 'If something about a performance needs a second look (a video problem, an unusual skill), use Submit & Flag. You submit your score as normal and write a short reason; the administrator sees the flag and resolves it.' },
      { type: 'callout', variant: 'warning', text: 'Submitting is final from your side. To change a submitted score, ask the administrator to reopen it; your entries are kept.' },
      { type: 'p', text: 'You see points scored out of points available for your panel. Percentages are only calculated once all panels are combined.' },
    ],
  },
  {
    slug: 'judge-score-tracking',
    title: 'Score Tracking',
    summary: 'Comparing your scores across every team you have judged in the event.',
    audience: 'judge',
    keywords: ['score tracking', 'tracking', 'compare', 'consistency', 'division', 'drawer'],
    blocks: [
      { type: 'p', text: 'When the administrator turns on Score Tracking for an event, a Score Tracking tab appears on the right edge of the scoring screen. Click it to slide out a table of every team assigned to you in that event, grouped by division.' },
      { type: 'image', src: `${J}/tracking.webp`, alt: 'Score Tracking drawer showing teams in a division with scores per field', caption: 'Each division can be opened or closed. The team you are scoring now is outlined in blue.' },
      {
        type: 'bullets',
        items: [
          'One column per field on your panel, plus a Total.',
          'Teams are sorted by total, highest first; teams you have not scored yet are at the bottom.',
          'Green numbers are submitted scores, amber numbers are drafts, grey dashes are not scored yet.',
          'You only ever see your own scores.',
          'Close the drawer with the arrow at the top right.',
        ],
      },
      { type: 'callout', variant: 'tip', text: 'Use Score Tracking before you submit to make sure similar performances get similar scores across a division.' },
      { type: 'callout', variant: 'note', text: 'Score Tracking is not shown to the Deductions (SD) judge.' },
    ],
  },
  {
    slug: 'judge-drafts',
    title: 'Save Draft & Resuming',
    summary: 'Pausing mid-score and picking it back up.',
    audience: 'judge',
    keywords: ['draft', 'save', 'resume', 'pause'],
    blocks: [
      {
        type: 'bullets',
        items: [
          'Save Draft keeps everything you have entered without submitting it.',
          'The team stays in your Pending queue; open it again to carry on.',
          'Drafts do not count toward results until you submit.',
          'In Score Tracking, draft totals show in amber.',
        ],
      },
    ],
  },
  {
    slug: 'judge-deductions',
    title: 'Deductions (SD) Panel',
    summary: 'What the deductions panel covers and how its total works.',
    audience: 'judge',
    keywords: ['deductions', 'sd', 'safety', 'penalty', 'falls', 'total deductions'],
    blocks: [
      { type: 'p', text: 'Deductions are a separate panel held by one judge. If you hold the SD panel, you see the list of deductions instead of score fields.' },
      {
        type: 'bullets',
        items: [
          'Enter how many times each deduction happened. Each line shows its value (for example Athlete Fall −0.15 each).',
          'Warnings can be recorded next to the count where the rubric uses them.',
          'The Total Deductions number at the bottom updates as you enter counts.',
          'Deductions come off the final score out of 100, not off raw points.',
          'Judges on other panels never see deduction controls.',
        ],
      },
    ],
  },
  {
    slug: 'judge-rubrics',
    title: 'Rubrics',
    summary: 'Opening the published rubric for the discipline you are judging.',
    audience: 'judge',
    keywords: ['rubric', 'reference', 'discipline'],
    blocks: [
      { type: 'p', text: 'Click Scoring Rubrics in the side menu to see every discipline. Each one opens the published rubric in a new tab.' },
      { type: 'image', src: `${J}/rubrics-menu.webp`, alt: 'Scoring Rubrics menu expanded with a list of disciplines', caption: 'The Scoring Rubrics menu, sorted alphabetically.' },
      { type: 'p', text: 'While scoring, the Rubrics button at the top of the scoring screen opens the same list, so you can check wording without losing your place.' },
    ],
  },
  {
    slug: 'judge-settings',
    title: 'Settings & Password',
    summary: 'Updating your name, photo and password.',
    audience: 'judge',
    keywords: ['settings', 'password', 'avatar', 'profile', 'photo'],
    blocks: [
      { type: 'p', text: 'Open Settings from the bottom of the side menu, just above Log Out.' },
      { type: 'image', src: `${J}/settings.webp`, alt: 'Judge settings page with profile and password sections' },
      {
        type: 'bullets',
        items: [
          'Profile — set your full name and upload a photo (PNG or JPG, up to 5MB). Your photo appears in the side menu.',
          'Change Password — enter your current password, then the new one twice. New passwords must be at least 8 characters.',
          'Your email address cannot be changed here. Contact the administrator.',
        ],
      },
      { type: 'callout', variant: 'tip', text: 'Forgot your current password? Log out and use the reset link on the sign-in page.' },
    ],
  },
  {
    slug: 'judge-broadcast-messages',
    title: 'Messages from the Administrator',
    summary: 'Announcements sent to you during an event.',
    audience: 'judge',
    keywords: ['broadcast', 'message', 'announcement', 'bell'],
    blocks: [
      {
        type: 'bullets',
        items: [
          'Messages drop down from the top of the screen while you are logged in.',
          'Anything sent while you were away appears when you next sign in.',
          'Dismiss a message to clear it; past messages stay under the bell at the top right.',
        ],
      },
    ],
  },
];
