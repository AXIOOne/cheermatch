// Read-only catalog of emails whose layout is built into the sending code.
// Sample HTML mirrors the backend functions so admins can preview them.

export interface BuiltInEmail {
  key: string;
  name: string;
  audience: string;
  trigger: string;
  subject: string;
  html: string;
  /** If set, the default layout can be replaced by an editable template on this tab. */
  overridableBy?: 'review_link' | 'welcome';
}

const year = new Date().getFullYear();
const LOGO = 'https://qzckpzwhkevqhwywlrkf.supabase.co/storage/v1/object/public/email-assets/logo-white.png';

const shell = (header: string, body: string, footer: string) => `
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background-color:#000000;padding:32px;text-align:center;">${header}</td></tr>
<tr><td style="padding:40px 32px;">${body}</td></tr>
<tr><td style="background-color:#fafafa;padding:24px 32px;text-align:center;"><p style="margin:0;color:#a1a1aa;font-size:12px;">${footer}<br>© ${year} CheerMatch. All rights reserved.</p></td></tr>
</table></td></tr></table></body>`;

const btn = (label: string) =>
  `<table width="100%"><tr><td align="center"><a href="#" style="display:inline-block;background-color:#000000;color:#ffffff;padding:14px 32px;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a></td></tr></table>`;

const welcomeHtml = shell(
  `<img src="${LOGO}" alt="CheerMatch" width="180" style="display:block;margin:0 auto;max-width:180px;" />`,
  `<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Welcome John Smith!</h2>
   <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">Your CheerMatch account has been created as a <strong>Gym Coach</strong>. Here are your login credentials:</p>
   <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin-bottom:24px;font-size:14px;color:#3f3f46;"><p style="margin:0 0 12px;"><strong>Email:</strong> john@example.com</p><p style="margin:0;"><strong>Password:</strong> TempPass123!</p></div>
   <p style="margin:0 0 32px;color:#ef4444;font-size:14px;">⚠️ For security, please change your password after your first login.</p>${btn('Log In Now')}`,
  'This is an automated message. Please do not reply to this email.',
);

const reviewHtml = shell(
  `<h1 style="margin:0;color:#ffffff;font-size:24px;">CheerMatch</h1>`,
  `<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Hello John Smith,</h2>
   <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">The scores for your team <strong>Elite Stars</strong> from <strong>Cheer Academy</strong> at <strong>National Championship 2026</strong> are now available for review.</p>
   <p style="margin:0 0 32px;color:#3f3f46;font-size:16px;">You can view the detailed score breakdown and submit a review request if needed.</p>${btn('View Scores')}`,
  'This link will expire in 30 days.',
);

const scoresheet = (accuscore: boolean) => `
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#6ea8dd;color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;">Score Sheet</h1><p style="margin:10px 0 0;opacity:.9;">National Championship 2026</p>
  </div>
  <div style="background:white;padding:30px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
    <p>Dear John Smith,</p>
    <p>${accuscore ? 'We have reviewed your AccuScore request.' : "Here are the official scores for your team's performance:"}</p>
    ${accuscore ? `<div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:20px 0;"><p style="margin:0;"><strong>AccuScore request:</strong> Building Review</p><p style="margin:8px 0 0;"><strong>Decision:</strong> Honored</p><p style="margin:8px 0 0;"><strong>Response:</strong><br/>After review, the stunt difficulty score has been adjusted.</p></div><p>Your current scoresheet is attached.</p>` : ''}
    <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:20px 0;"><p style="margin:0;"><strong>Team:</strong> Elite Stars</p><p style="margin:8px 0 0;"><strong>Gym:</strong> Cheer Academy</p><p style="margin:8px 0 0;"><strong>Division:</strong> Senior Elite</p><p style="margin:8px 0 0;"><strong>Level:</strong> Level 4</p></div>
    <div style="background:#f0f9ff;padding:20px;border-radius:8px;margin:20px 0;text-align:center;"><p style="margin:0;color:#666;">Average Score</p><div style="font-size:48px;font-weight:bold;color:#6ea8dd;">92.45</div></div>
    ${accuscore ? '' : `<div style="background:#eff6ff;border:1px solid #bfdbfe;padding:16px;border-radius:8px;margin:20px 0;"><p style="margin:0 0 12px;"><strong>Need a score reviewed?</strong> Submit one or more AccuScore requests. After the cutoff, scores are final.</p><a href="#" style="display:inline-block;background:#6ea8dd;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Open AccuScore Request</a> <span style="font-size:13px;color:#334155;"><strong>Requests accepted until:</strong> Friday, October 16, 2026 at 5:00 PM CDT</span><p style="font-size:12px;color:#64748b;margin:8px 0 0;">(Shown only when AccuScore is turned on for the event.)</p></div>`}
    <h2>Score Breakdown</h2>
    <div style="margin-bottom:20px;border:1px solid #ddd;border-radius:8px;overflow:hidden;"><div style="background:#f5f5f5;padding:12px 16px;font-weight:bold;">Building 1 - Score: 46.50</div>
      <table style="width:100%;border-collapse:collapse;"><tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">Stunts — Difficulty</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">9.5 / 10</td></tr><tr><td style="padding:4px 8px;">Pyramid — Execution</td><td style="padding:4px 8px;text-align:right;">8.0 / 10</td></tr></table></div>
    <p style="margin-top:30px;color:#666;font-size:14px;">If you have any questions about your scores, please contact the event organizers.</p>
    <p style="font-size:12px;color:#64748b;">A PDF scoresheet is attached to this email.</p>
  </div>
</div></body>`;

const revisionHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;padding:20px;">
  <h2>Revision requested for Elite Stars</h2><p>Hello John Smith,</p>
  <p>An administrator has reviewed your submission for <strong>National Championship 2026</strong> and requested a revision.</p>
  <blockquote style="background:#f1f5f9;border-left:4px solid #6ea8dd;padding:12px 16px;margin:16px 0;border-radius:6px;"><strong>Reviewer notes:</strong><br>The video cuts off before the end of the routine.</blockquote>
  <p>Please open the Cheermatch Mobile Capture App, find the team, and submit a new video.</p>
  <p style="color:#64748b;font-size:12px;margin-top:32px;">— Cheermatch</p>
</div>`;

const resetHtml = `
<div style="font-family:Arial,sans-serif;padding:20px;">
  <p>Hi John Smith,</p><p>Your password reset code is:</p><h2 style="letter-spacing:6px;">482913</h2>
  <p>This code expires in 1 hour. If you didn't request this, ignore this email.</p>
</div>`;

export const BUILT_IN_EMAILS: BuiltInEmail[] = [
  { key: 'welcome', name: 'Welcome / Account Invite', audience: 'Coaches, judges, admins', trigger: 'New user created, coach invited, or invite re-sent', subject: 'Welcome to CheerMatch - Your Account Details', html: welcomeHtml, overridableBy: 'welcome' },
  { key: 'review_link', name: 'Score Review Link', audience: 'Coaches', trigger: 'Admin sends a review link from Submissions', subject: 'Score Review Available: {{teamName}} - {{eventName}}', html: reviewHtml, overridableBy: 'review_link' },
  { key: 'scoresheet', name: 'Score Sheet', audience: 'Coaches', trigger: 'Admin sends the scoresheet from the Scoring Control Panel', subject: 'Score Sheet - {{teamName}} | {{eventName}}', html: scoresheet(false) },
  { key: 'accuscore_response', name: 'AccuScore Response', audience: 'Coaches', trigger: 'Admin sends a decision on an AccuScore request', subject: 'AccuScore Response - {{teamName}} | {{eventName}}', html: scoresheet(true) },
  { key: 'revision', name: 'Revision Requested', audience: 'Coaches', trigger: 'Admin requests a new video for a submission', subject: 'Revision requested: {{teamName}}', html: revisionHtml },
  { key: 'reset', name: 'Password Reset Code', audience: 'Mobile app users', trigger: 'User taps "Forgot password" in the mobile app', subject: 'Your Cheermatch password reset code', html: resetHtml },
];
