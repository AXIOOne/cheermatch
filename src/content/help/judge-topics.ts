import type { HelpTopic } from './types';

export const judgeTopics: HelpTopic[] = [
  {
    slug: 'judge-getting-started',
    title: 'Getting Started for Judges',
    summary: 'What you see when you sign in and how your work is organised.',
    audience: 'judge',
    keywords: ['judge', 'start', 'dashboard', 'events'],
    blocks: [
      { type: 'p', text: 'Your dashboard lists the events you have been assigned to, along with the date scoring is scheduled to open for each one.' },
      {
        type: 'bullets',
        items: [
          'Dashboard — your assigned events and when scoring opens.',
          'Scoring Queue — the teams waiting for your score.',
          'Rubrics — the published rubric for each discipline.',
          'Messages — broadcasts sent by the event administrator.',
        ],
      },
      { type: 'callout', variant: 'note', text: 'If an event is not visible yet, the administrator has not opened it for capture or scoring. The scoring open date on your dashboard tells you when to expect it.' },
    ],
  },
  {
    slug: 'judge-queue',
    title: 'Scoring Queue & Panel Assignments',
    summary: 'How your queue is built and what happens when you hold more than one panel slot.',
    audience: 'judge',
    keywords: ['queue', 'panel', 'assignment', 'teams'],
    blocks: [
      { type: 'p', text: 'Your queue shows one card per panel assignment — not per team. If you hold two slots for the same team (for example building difficulty and building execution), you get two cards and score them separately.' },
      {
        type: 'bullets',
        items: [
          'Each card shows the team, division, your panel slot, and its current status.',
          'A card only appears once the team has a playable video.',
          'Cards marked Draft Saved can be resumed where you left off.',
          'A card that returns to your queue after you submitted it was re-opened by an administrator for a correction.',
        ],
      },
    ],
  },
  {
    slug: 'judge-scoring',
    title: 'Scoring a Performance',
    summary: 'Working through the scoresheet, the field types you will meet, and automatic comments.',
    audience: 'judge',
    keywords: ['scoring', 'score', 'difficulty driver', 'execution driver', 'comments'],
    blocks: [
      {
        type: 'steps',
        items: [
          'Open the card from your queue. The video plays beside the scoresheet.',
          'Work down the criteria assigned to your panel slot.',
          'Add any comments in Comments & Feedback.',
          'Save Draft to pause, or Submit when you are finished.',
        ],
      },
      { type: 'heading', text: 'Field types' },
      {
        type: 'table',
        head: ['Type', 'How to score it'],
        rows: [
          ['Numeric score', 'Use the + and − buttons to step the value, usually in 0.5 increments, up to the field maximum.'],
          ['Difficulty driver', 'Select one radio value per listed skill. The field total is the sum of what you selected.'],
          ['Execution driver', 'The field starts at a set value. Select the technique issues you observed; their reduction values come off the start value and the score never goes below zero.'],
        ],
      },
      { type: 'callout', variant: 'note', title: 'Automatic comments', text: 'Each technique issue you select on an execution driver adds a line to Comments & Feedback under that field’s name, in the form “technique issue: point value removed”. You can add your own notes around it.' },
      { type: 'p', text: 'You see points scored out of points available for your slot. Percentages are not shown per judge — the percentage is only calculated once the whole panel is combined.' },
      { type: 'callout', variant: 'warning', text: 'Submitting is final from your side. If you need to change a submitted score, ask the administrator to re-open the panel; your entries are preserved.' },
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
          'Save Draft stores everything you have entered without submitting it.',
          'The card in your queue shows a Draft Saved badge and a Resume Draft action.',
          'Drafts do not count toward results or reports until you submit.',
          'Administrators can see that a draft exists and preview it, but cannot change it.',
        ],
      },
    ],
  },
  {
    slug: 'judge-deductions',
    title: 'Deductions (SD) Panel',
    summary: 'What the deductions assignment covers and how it affects the final score.',
    audience: 'judge',
    keywords: ['deductions', 'sd', 'safety', 'penalty'],
    blocks: [
      { type: 'p', text: 'Deductions are a separate panel assignment held by one judge. If you hold that slot, you see the deductions catalogue for the team instead of the standard criteria.' },
      {
        type: 'bullets',
        items: [
          'Select each deduction observed; the total is recorded against the team.',
          'Deductions are subtracted from the converted 100-point score, not from raw points.',
          'Judges on other slots do not see deduction controls at all.',
        ],
      },
    ],
  },
  {
    slug: 'judge-rubrics',
    title: 'Rubrics',
    summary: 'Reaching the published rubric for the discipline you are judging.',
    audience: 'judge',
    keywords: ['rubric', 'reference', 'discipline'],
    blocks: [
      { type: 'p', text: 'The Rubrics item in the sidebar opens a list of disciplines. Select the discipline you are judging to open its published rubric. A reference sheet is also available from within the scoring screen so you can check wording without losing your place.' },
    ],
  },
  {
    slug: 'judge-broadcast-messages',
    title: 'Broadcast Messages',
    summary: 'Announcements sent to you by the event administrator.',
    audience: 'judge',
    keywords: ['broadcast', 'message', 'announcement'],
    blocks: [
      {
        type: 'bullets',
        items: [
          'Messages drop down from the top of the screen while you are logged in.',
          'Anything sent while you were away appears when you next sign in.',
          'Dismiss a message to clear the banner; it stays available in your messages menu.',
        ],
      },
    ],
  },
];
