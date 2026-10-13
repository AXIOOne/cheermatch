// Single source of truth for built-in email layouts.
// Pure TypeScript (no Deno/npm imports) so the admin portal can import the
// same builders to render live previews.

export const BRAND_BLUE = '#6ea8dd';
export const BRAND_BLACK = '#000000';
// Absolute public URL from varsity-email-logo.png.asset.json: email clients
// cannot resolve the host-relative asset URLs used inside the portal.
export const EMAIL_LOGO = 'https://score.cheermatch.com/__l5e/assets-v1/120218a2-c600-4f66-9d69-8772faff2f69/varsity-email-logo.png';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const year = () => new Date().getFullYear();

// ---- Editable subject lines ---------------------------------------------
// Admins can override any built-in subject in the portal. Overrides live in
// platform_settings under the key 'email_subjects' as { [emailKey]: subject }.
// Subjects support {{variable}} placeholders, filled in at send time.
export type EmailSubjectOverrides = Record<string, string> | null | undefined;

export function applySubjectVars(subject: string, vars: Record<string, string | null | undefined>): string {
  return subject.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
}

export function resolveEmailSubject(
  overrides: EmailSubjectOverrides,
  key: string,
  fallback: string,
  vars: Record<string, string | null | undefined>,
): string {
  const custom = overrides && typeof overrides[key] === 'string' && overrides[key].trim() ? overrides[key] : null;
  return applySubjectVars(custom ?? fallback, vars);
}

export const EMAIL_SUBJECTS_SETTINGS_KEY = 'email_subjects';

function shell(opts: { subtitle?: string; body: string; footer: string }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Roboto,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
<tr><td style="background-color:#ffffff;padding:28px 32px;text-align:center;border-bottom:4px solid ${BRAND_BLUE};">
<img src="${EMAIL_LOGO}" alt="Varsity Virtual" width="160" style="display:block;margin:0 auto;max-width:160px;height:auto;" />
${opts.subtitle ? `<p style="margin:12px 0 0;color:${BRAND_BLACK};font-size:15px;">${opts.subtitle}</p>` : ''}
</td></tr>
<tr><td style="padding:36px 32px;color:#3f3f46;font-size:16px;line-height:1.6;">${opts.body}</td></tr>
<tr><td style="background-color:#fafafa;padding:24px 32px;text-align:center;"><p style="margin:0;color:#a1a1aa;font-size:12px;">${opts.footer}<br>© ${year()} CheerMatch. All rights reserved.</p></td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="${href}" style="display:inline-block;background-color:${BRAND_BLUE};color:#ffffff;padding:14px 32px;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a></td></tr></table>`;

const fallbackLink = (href: string) =>
  `<p style="margin:32px 0 0;color:#71717a;font-size:14px;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${href}" style="color:${BRAND_BLUE};word-break:break-all;">${href}</a></p>`;

const heading = (t: string) => `<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">${t}</h2>`;

export function welcomeEmailHtml(p: { fullName?: string | null; email: string; password: string; roleText?: string | null; loginUrl: string }) {
  return shell({
    body: `${heading(`Welcome${p.fullName ? ` ${p.fullName}` : ''}!`)}
<p style="margin:0 0 24px;">Your CheerMatch account has been created${p.roleText ? ` as a <strong>${p.roleText}</strong>` : ''}. Here are your login credentials:</p>
<div style="background:#f4f4f5;border-radius:8px;padding:20px;margin-bottom:24px;font-size:14px;"><p style="margin:0 0 12px;"><strong>Email:</strong> ${p.email}</p><p style="margin:0;"><strong>Password:</strong> ${p.password}</p></div>
<p style="margin:0 0 32px;color:#ef4444;font-size:14px;">⚠️ For security, please change your password after your first login.</p>
${button(p.loginUrl, 'Log In Now')}${fallbackLink(p.loginUrl)}`,
    footer: 'This is an automated message. Please do not reply to this email.',
  });
}
export const welcomeEmailSubject = 'Welcome to CheerMatch - Your Account Details';

export const IOS_CAPTURE_APP_URL = 'https://apps.apple.com/kg/app/varsity-virtual-compete/id6800264562';
// Set once the test-capture request page exists; empty shows "coming soon".
export const TEST_CAPTURE_URL = '';
export const SUPPORT_EMAIL = 'support@cheermatch.com';

export function coachWelcomeEmailHtml(p: { fullName?: string | null; email: string; password: string; loginUrl: string; gymName?: string | null; testCaptureUrl?: string | null }) {
  const testUrl = p.testCaptureUrl ?? TEST_CAPTURE_URL;
  const box = 'background:#f4f4f5;border-radius:8px;padding:20px;margin-bottom:24px;font-size:14px;';
  return shell({
    body: `${heading(`Welcome${p.fullName ? ` ${esc(p.fullName)}` : ''}!`)}
<p style="margin:0 0 16px;">Welcome to Varsity Virtual! Your <strong>Gym Coach</strong> account${p.gymName ? ` for <strong>${esc(p.gymName)}</strong>` : ''} is ready. You'll use it to record and submit your team's performance videos with the Varsity Virtual Compete capture app.</p>
<p style="margin:0 0 12px;"><strong>Your login credentials</strong></p>
<div style="${box}"><p style="margin:0 0 12px;"><strong>Username:</strong> ${esc(p.email)}</p><p style="margin:0;"><strong>Password:</strong> ${esc(p.password)}</p></div>
<p style="margin:0 0 28px;color:#ef4444;font-size:14px;">For security, please change your password after your first login.</p>
<p style="margin:0 0 12px;"><strong>1. Download the iOS Capture App</strong></p>
<p style="margin:0 0 16px;">Install Varsity Virtual Compete on your iPhone or iPad and sign in with the credentials above.</p>
${button(IOS_CAPTURE_APP_URL, 'Download on the App Store')}${fallbackLink(IOS_CAPTURE_APP_URL)}
<p style="margin:28px 0 12px;"><strong>2. Request a TEST capture</strong></p>
<p style="margin:0 0 16px;">Before competition day, request a test capture to practice recording and submitting, and watch the training video to learn how the app works.</p>
${testUrl ? `${button(testUrl, 'Request a Test Capture')}${fallbackLink(testUrl)}` : `<div style="${box}color:#6b7280;">Test capture requests and the training video are coming soon. We'll share the link with you shortly.</div>`}
<p style="margin:28px 0 0;">Questions or need assistance? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_BLUE};">${SUPPORT_EMAIL}</a>.</p>`,
    footer: 'This is an automated message. Please do not reply to this email.',
  });
}
export const coachWelcomeEmailSubject = 'Welcome to Varsity Virtual – Your Coach Account';

export function reviewEmailHtml(p: { coachName?: string | null; teamName: string; gymName?: string | null; eventName: string; reviewUrl: string }) {
  return shell({
    body: `${heading(`Hello${p.coachName ? ` ${p.coachName}` : ''},`)}
<p style="margin:0 0 24px;">The scores for your team <strong>${p.teamName}</strong>${p.gymName ? ` from <strong>${p.gymName}</strong>` : ''} at <strong>${p.eventName}</strong> are now available for review.</p>
<p style="margin:0 0 32px;">You can view the detailed score breakdown and submit a review request if needed.</p>
${button(p.reviewUrl, 'View Scores')}${fallbackLink(p.reviewUrl)}`,
    footer: 'This link will expire in 30 days.',
  });
}
export const reviewEmailSubject = (teamName: string, eventName: string) => `Score Review Available: ${teamName} - ${eventName}`;

export function revisionEmailHtml(p: { teamName?: string | null; coachName?: string | null; eventName?: string | null; notes?: string | null }) {
  return shell({
    body: `${heading(`Revision requested for ${esc(p.teamName ?? 'your team')}`)}
<p>Hello${p.coachName ? ' ' + esc(p.coachName) : ''},</p>
<p>An administrator has reviewed your submission for <strong>${esc(p.eventName ?? 'your event')}</strong> and requested a revision.</p>
${p.notes ? `<blockquote style="background:#f1f5f9;border-left:4px solid ${BRAND_BLUE};padding:12px 16px;margin:16px 0;border-radius:6px;"><strong>Reviewer notes:</strong><br>${esc(p.notes).replace(/\n/g, '<br>')}</blockquote>` : ''}
<p>Please open the Cheermatch Mobile Capture App, find the team, and submit a new video.</p>`,
    footer: 'This is an automated message. Please do not reply to this email.',
  });
}
export const revisionEmailSubject = (teamName?: string | null) => `Revision requested: ${teamName ?? 'your submission'}`;

export function resetCodeEmailHtml(p: { fullName?: string | null; code: string }) {
  return shell({
    body: `<p>Hi ${esc(p.fullName ?? '')},</p><p>Your password reset code is:</p>
<p style="margin:16px 0;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND_BLUE};">${esc(p.code)}</p>
<p>This code expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    footer: 'This is an automated message. Please do not reply to this email.',
  });
}
export const resetCodeEmailSubject = 'Your Cheermatch password reset code';

export interface ScoresheetPanel { panelName: string; total: number | null; rows: { label: string; points: number; max: number }[]; deductions?: number | null; comments?: string | null }

export function scoresheetEmailHtml(p: {
  eventName: string; coachName?: string | null; teamName: string; gymName?: string | null; divisionName?: string | null; levelName?: string | null;
  averageScore: number; panels: ScoresheetPanel[];
  accuscore?: { url: string; cutoffText: string | null } | null;
  response?: { formName: string; decision: string; response: string } | null;
}) {
  const responseBlock = p.response ? `
<div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:20px 0;">
<p style="margin:0;"><strong>AccuScore request:</strong> ${esc(p.response.formName)}</p>
<p style="margin:8px 0 0;"><strong>Decision:</strong> ${esc(p.response.decision)}</p>
<p style="margin:8px 0 0;white-space:pre-wrap;"><strong>Response:</strong><br/>${esc(p.response.response)}</p></div>
<p>Your current scoresheet is attached.</p>` : '';
  const accuscoreBlock = !p.response && p.accuscore ? `
<div style="background:#eff6ff;border:1px solid #bfdbfe;padding:16px;border-radius:8px;margin:20px 0;">
<p style="margin:0 0 12px;"><strong>Need a score reviewed?</strong> Submit one or more AccuScore requests. After the cutoff, scores are final.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
<td style="vertical-align:middle;padding-right:12px;"><a href="${p.accuscore.url}" style="display:inline-block;background:${BRAND_BLUE};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Open AccuScore Request</a></td>
<td style="vertical-align:middle;font-size:13px;color:#334155;"><strong>Requests accepted until:</strong><br/>${p.accuscore.cutoffText ? esc(p.accuscore.cutoffText) : 'No cutoff set'}</td>
</tr></table></div>` : '';
  const breakdown = p.response ? p.panels.map((s) => `
<div style="margin-bottom:20px;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
<div style="background:#f5f5f5;padding:12px 16px;font-weight:bold;border-left:4px solid ${BRAND_BLUE};">${s.panelName} - Score: ${s.total != null ? s.total.toFixed(2) : 'N/A'}</div>
<table style="width:100%;border-collapse:collapse;font-size:14px;">${s.rows.map((r) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${r.label}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${r.points} / ${r.max}</td></tr>`).join('')}</table>
${s.deductions ? `<div style="padding:8px 16px;color:#dc2626;">Deductions: -${s.deductions}</div>` : ''}
${s.comments ? `<div style="padding:8px 16px;font-style:italic;color:#666;">Comments: ${s.comments}</div>` : ''}
</div>`).join('') : '';
  return shell({
    subtitle: `${p.response ? 'AccuScore Response' : 'Score Sheet'} · ${esc(p.eventName)}`,
    body: `<p>Dear ${esc(p.coachName || 'Coach')},</p>
<p>${p.response ? 'We have reviewed your AccuScore request.' : "Your team's official PDF scoresheet is attached to this email."}</p>
${responseBlock}
<div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:20px 0;font-size:15px;">
<p style="margin:0;"><strong>Team:</strong> ${esc(p.teamName)}</p><p style="margin:8px 0 0;"><strong>Gym:</strong> ${esc(p.gymName || '')}</p>
<p style="margin:8px 0 0;"><strong>Division:</strong> ${esc(p.divisionName || 'N/A')}</p><p style="margin:8px 0 0;"><strong>Level:</strong> ${esc(p.levelName || 'N/A')}</p></div>
${p.response ? `<div style="background:#f0f9ff;padding:20px;border-radius:8px;margin:20px 0;text-align:center;"><p style="margin:0;color:#666;">Average Score</p><div style="font-size:48px;font-weight:bold;color:${BRAND_BLUE};">${p.averageScore.toFixed(2)}</div></div>` : `<div style="background:#f0f9ff;padding:20px;border-radius:8px;margin:20px 0;text-align:center;"><p style="margin:0;font-size:20px;font-weight:bold;color:${BRAND_BLUE};">Your PDF Scoresheet</p><p style="margin:8px 0 0;">Please download the PDF scoresheet attached to this email to view your scores and judges’ feedback.</p></div>`}
${accuscoreBlock}
${p.response ? `<h2 style="color:#18181b;font-size:20px;">Score Breakdown</h2>${breakdown}
<p style="margin-top:30px;color:#666;font-size:14px;">If you have any questions about your scores, please contact the event organizers.</p>` : ''}`,
    footer: 'A PDF copy of this scoresheet is attached.',
  });
}
export const scoresheetEmailSubject = (teamName: string, eventName: string, isAccuscore: boolean) =>
  `${isAccuscore ? 'AccuScore Response' : 'Score Sheet'} - ${teamName} | ${eventName}`;
