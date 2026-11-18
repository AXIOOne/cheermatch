import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@4.0.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { assertScoresheetsReviewed } from '../_shared/scoresheet-readiness.ts'
import { divisionReportRecipients } from '../_shared/division-report-recipients.ts'
import { divisionReportsEmailHtml, divisionReportsEmailSubject } from '../_shared/email-layouts.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const b64 = /^[A-Za-z0-9+/=]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) throw new Error('Email service not configured')
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: auth } = await db.auth.getUser(jwt)
    if (!auth?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: isAdmin } = await db.rpc('has_role', { _user_id: auth.user.id, _role: 'admin' })
    if (!isAdmin) return json({ error: 'Forbidden' }, 403)

    const body = await req.json()
    const { eventId, divisionId, divisionName, rankingsPdf, averagesPdf } = body ?? {}
    const sample = body?.sample === true
    if (!uuid.test(eventId) || !uuid.test(divisionId) || typeof divisionName !== 'string' || !divisionName.trim()
      || typeof rankingsPdf !== 'string' || !b64.test(rankingsPdf) || typeof averagesPdf !== 'string' || !b64.test(averagesPdf)
      || rankingsPdf.length > 8_000_000 || averagesPdf.length > 8_000_000) {
      return json({ error: 'Invalid division report request' }, 400)
    }

    // Whole event must be reviewed before any division report goes out.
    const { data: anySub, error: subErr } = await db.from('video_submissions').select('id')
      .eq('event_id', eventId).is('archived_at', null).not('team_id', 'is', null).limit(1).maybeSingle()
    if (subErr || !anySub) throw new Error('No scored teams in this event')
    await assertScoresheetsReviewed(db, anySub.id, eventId)

    const { data: event } = await db.from('events').select('name').eq('id', eventId).single()
    const eventName = event?.name || 'Event'
    const { data: teams, error: teamErr } = await db.from('teams')
      .select('coach_email, coach_name, coach_user_id, submissions:video_submissions!inner(id, archived_at)')
      .eq('event_id', eventId).eq('division_id', divisionId).is('submissions.archived_at', null)
    if (teamErr) throw teamErr
    const userIds = [...new Set((teams || []).map((t: any) => t.coach_user_id).filter(Boolean))]
    const { data: profiles } = userIds.length
      ? await db.from('profiles').select('user_id, email, full_name').in('user_id', userIds) : { data: [] }
    const byUser = new Map((profiles || []).map((p: any) => [p.user_id, p]))
    const recipients = sample
      ? [{ email: auth.user.email!, name: null }]
      : divisionReportRecipients((teams || []).map((t: any) => ({
          coach_email: t.coach_email, coach_name: t.coach_name,
          profile_email: byUser.get(t.coach_user_id)?.email, profile_name: byUser.get(t.coach_user_id)?.full_name,
        })))

    const resend = new Resend(key)
    const safe = (s: string) => s.replace(/[^\w\s-]/g, '').trim() || 'report'
    const subject = divisionReportsEmailSubject(divisionName, eventName)
    const failures: string[] = []
    let sent = 0
    for (const r of recipients) {
      const { error } = await resend.emails.send({
        from: 'CheerMatch <noreply@cheermatch.com>',
        to: [r.email],
        subject: sample ? `[SAMPLE] ${subject}` : subject,
        html: divisionReportsEmailHtml({ coachName: r.name, eventName, divisionName }),
        attachments: [
          { filename: `${safe(`${divisionName} - Rankings`)}.pdf`, content: rankingsPdf },
          { filename: `${safe(`${divisionName} - Averages`)}.pdf`, content: averagesPdf },
        ],
      })
      if (error) failures.push(r.email); else sent++
    }
    return json({ success: true, sent, failed: failures.length, failures })
  } catch (e: any) {
    console.error('send-division-reports error:', e)
    return json({ error: e.message }, 500)
  }
})
