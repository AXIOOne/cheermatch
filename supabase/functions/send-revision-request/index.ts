// POST /functions/v1/send-revision-request
// Admin-only. Emails a coach that their submission needs revision.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { revisionEmailHtml, revisionEmailSubject } from '../_shared/email-layouts.ts'

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

    const html = revisionEmailHtml({ teamName: team?.name || team?.gym_name, coachName: team?.coach_name, eventName: event?.name, notes })

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Cheermatch <noreply@cheermatch.com>',
        to: [coachEmail],
        subject: revisionEmailSubject(team?.name || team?.gym_name),
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
