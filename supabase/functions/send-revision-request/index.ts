// POST /functions/v1/send-revision-request
// Admin-only. Emails a coach that their submission needs revision.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    const body = await req.json().catch(() => ({}))
    const submissionId = String(body.submissionId ?? '')
    const notes = String(body.notes ?? '').trim()
    if (!submissionId) return new Response(JSON.stringify({ error: 'submissionId required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    const { data: sub, error: sErr } = await admin
      .from('video_submissions')
      .select('id, team:teams!inner(name, coach_email, coach_name), event:events!inner(name)')
      .eq('id', submissionId)
      .maybeSingle()
    if (sErr) throw new Error(sErr.message)
    const team: any = (sub as any)?.team
    const event: any = (sub as any)?.event
    const coachEmail = String(team?.coach_email ?? '').trim()
    if (!coachEmail) return new Response(JSON.stringify({ error: 'No coach email on team' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    if (!resendKey) {
      // Soft-success: still record the action without email
      return new Response(JSON.stringify({ success: true, emailed: false, reason: 'RESEND_API_KEY not configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h2>Revision requested for ${team?.name ?? 'your team'}</h2>
        <p>Hello${team?.coach_name ? ' ' + team.coach_name : ''},</p>
        <p>An administrator has reviewed your submission for <strong>${event?.name ?? 'your event'}</strong>
        and requested a revision.</p>
        ${notes ? `<blockquote style="background:#f1f5f9;border-left:4px solid #14b8a6;padding:12px 16px;margin:16px 0;border-radius:6px"><strong>Reviewer notes:</strong><br>${notes.replace(/\n/g, '<br>')}</blockquote>` : ''}
        <p>Please open the Cheermatch Mobile Capture App, find the team, and submit a new video.</p>
        <p style="color:#64748b;font-size:12px;margin-top:32px">— Cheermatch</p>
      </div>`

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Cheermatch <noreply@cheermatch.com>',
        to: [coachEmail],
        subject: `Revision requested: ${team?.name ?? 'your submission'}`,
        html,
      }),
    })
    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => '')
      throw new Error(`Email failed: ${resp.status} ${errTxt}`)
    }

    return new Response(JSON.stringify({ success: true, emailed: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('send-revision-request error:', e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
