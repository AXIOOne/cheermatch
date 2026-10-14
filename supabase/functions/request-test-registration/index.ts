// Public: coach enters email -> adds a TEST registration on the CheerMatch TEST event.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const Body = z.object({
  action: z.enum(['info', 'request']).default('request'),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const parsed = Body.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return json({ error: 'Please enter a valid email address.' }, 400)
    const { action, email } = parsed.data

    const { data: settings } = await db.from('admin_settings').select('key,value')
      .in('key', ['test_event_id', 'test_division_id', 'training_video_url'])
    const s = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]))

    if (action === 'info') return json({ training_video_url: s.training_video_url || null })
    if (!email) return json({ error: 'Please enter a valid email address.' }, 400)

    const notFound = "We couldn't find a coach account with that email. Contact support@cheermatch.com."
    const { data: profile } = await db.from('profiles')
      .select('user_id, full_name, organization_name, organization_id, organizations(name)')
      .ilike('email', email).maybeSingle()
    if (!profile) return json({ error: notFound }, 404)
    const { data: isCoach } = await db.rpc('has_role', { _user_id: profile.user_id, _role: 'gym_coach' })
    if (!isCoach) return json({ error: notFound }, 404)

    let eventId = s.test_event_id as string | undefined
    if (!eventId) {
      const { data: ev } = await db.from('events').select('id').ilike('name', 'CheerMatch TEST Event%')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      eventId = ev?.id
    }
    if (!eventId) return json({ error: 'The test event is not set up yet. Contact support@cheermatch.com.' }, 500)

    const { data: existing } = await db.from('teams').select('id')
      .eq('event_id', eventId).eq('coach_user_id', profile.user_id).ilike('name', 'TEST%').limit(1)
    if (existing && existing.length) return json({ success: true, already: true })

    let divisionId = s.test_division_id as string | undefined
    if (!divisionId) {
      const { data: t } = await db.from('teams').select('division_id').eq('event_id', eventId).limit(1).maybeSingle()
      divisionId = t?.division_id
    }
    if (!divisionId) {
      const { data: d } = await db.from('divisions').select('id').order('name').limit(1).maybeSingle()
      divisionId = d?.id
    }
    if (!divisionId) return json({ error: 'The test event is not set up yet. Contact support@cheermatch.com.' }, 500)

    // deno-lint-ignore no-explicit-any
    const gym = (profile as any).organizations?.name || profile.organization_name || profile.full_name || 'Coach'
    const { error } = await db.from('teams').insert({
      event_id: eventId, division_id: divisionId, name: `TEST – ${gym}`, gym_name: gym,
      coach_user_id: profile.user_id, coach_email: email, coach_name: profile.full_name,
      organization_id: profile.organization_id,
    })
    if (error) throw error
    return json({ success: true, already: false })
  } catch (e) {
    console.error(e)
    return json({ error: 'Something went wrong. Please try again or contact support@cheermatch.com.' }, 500)
  }
})
