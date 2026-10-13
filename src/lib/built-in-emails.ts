// Catalog of built-in emails. Previews call the same layout builders the
// sending functions use, so any code change shows up here automatically.
import {
  welcomeEmailHtml, welcomeEmailSubject, coachWelcomeEmailHtml, coachWelcomeEmailSubject,
  reviewEmailHtml, revisionEmailHtml, resetCodeEmailHtml,
  resetCodeEmailSubject, scoresheetEmailHtml, type ScoresheetPanel,
} from '../../supabase/functions/_shared/email-layouts';

export interface BuiltInEmail {
  key: string;
  name: string;
  audience: string;
  trigger: string;
  subject: string;
  /** {{variables}} admins can use in a custom subject line */
  subjectVars: string[];
  render: () => string;
  overridableBy?: 'review_link' | 'welcome';
}

const panels: ScoresheetPanel[] = [
  { panelName: 'Building 1', total: 46.5, rows: [{ label: 'Stunts — Difficulty', points: 9.5, max: 10 }, { label: 'Pyramid — Execution', points: 8, max: 10 }] },
  { panelName: 'Safety & Deductions', total: 0, rows: [], deductions: 1 },
];
const sheet = { eventName: 'National Championship 2026', coachName: 'John Smith', teamName: 'Elite Stars', gymName: 'Cheer Academy', divisionName: 'Senior Elite', levelName: 'Level 4', averageScore: 92.45, panels };

export const BUILT_IN_EMAILS: BuiltInEmail[] = [
  { key: 'welcome', name: 'Welcome / Account Invite', audience: 'Admins, portal admins, judges', trigger: 'New admin, portal admin, or judge user created, or invite re-sent', subject: welcomeEmailSubject, subjectVars: ['fullName', 'email'], overridableBy: 'welcome',
    render: () => welcomeEmailHtml({ fullName: 'John Smith', email: 'john@example.com', password: 'TempPass123!', roleText: 'Judge', loginUrl: '#' }) },
  { key: 'coach_welcome', name: 'Coach Welcome / Invite', audience: 'Coaches', trigger: 'Coach account created or invited (Coach accounts panel, CSV import, registration)', subject: coachWelcomeEmailSubject, subjectVars: ['fullName', 'email', 'gymName'],
    render: () => coachWelcomeEmailHtml({ fullName: 'John Smith', email: 'john@example.com', password: 'TempPass123!', loginUrl: '#', gymName: 'Cheer Athletics' }) },
  { key: 'review_link', name: 'Score Review Link', audience: 'Coaches', trigger: 'Admin sends a review link from Submissions', subject: 'Score Review Available: {{teamName}} - {{eventName}}', subjectVars: ['coachName', 'teamName', 'gymName', 'eventName'], overridableBy: 'review_link',
    render: () => reviewEmailHtml({ coachName: 'John Smith', teamName: 'Elite Stars', gymName: 'Cheer Academy', eventName: 'National Championship 2026', reviewUrl: '#' }) },
  { key: 'scoresheet', name: 'Score Sheet', audience: 'Coaches', trigger: 'Admin sends the scoresheet from the Scoring Control Panel (AccuScore box shows only when AccuScore is on)', subject: 'Score Sheet - {{teamName}} | {{eventName}}', subjectVars: ['teamName', 'gymName', 'eventName', 'coachName', 'divisionName', 'levelName'],
    render: () => scoresheetEmailHtml({ ...sheet, accuscore: { url: '#', cutoffText: 'Friday, October 16, 2026 at 5:00 PM CDT' } }) },
  { key: 'accuscore_response', name: 'AccuScore Response', audience: 'Coaches', trigger: 'Admin sends a decision on an AccuScore request', subject: 'AccuScore Response - {{teamName}} | {{eventName}}', subjectVars: ['teamName', 'gymName', 'eventName', 'coachName', 'divisionName', 'levelName'],
    render: () => scoresheetEmailHtml({ ...sheet, response: { formName: 'Building Review', decision: 'Honored', response: 'After review, the stunt difficulty score has been adjusted.' } }) },
  { key: 'revision', name: 'Revision Requested', audience: 'Coaches', trigger: 'Admin requests a new video for a submission', subject: 'Revision requested: {{teamName}}', subjectVars: ['teamName', 'coachName', 'eventName'],
    render: () => revisionEmailHtml({ teamName: 'Elite Stars', coachName: 'John Smith', eventName: 'National Championship 2026', notes: 'The video cuts off before the end of the routine.' }) },
  { key: 'reset', name: 'Password Reset Code', audience: 'Mobile app users', trigger: 'User taps "Forgot password" in the mobile app', subject: resetCodeEmailSubject, subjectVars: ['fullName'],
    render: () => resetCodeEmailHtml({ fullName: 'John Smith', code: '482913' }) },
];
