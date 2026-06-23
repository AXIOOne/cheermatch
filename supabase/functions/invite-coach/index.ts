// POST /functions/v1/invite-coach
// Admin-only. Creates auth user + profile + gym_coach role for a coach email
// if missing, then sends/resets a temporary password and emails the invite.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
}

function generatePassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length]
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No authorization header' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !requestingUser) return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: requestingUser.id, _role: 'admin'
    })
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const fullName = body.fullName ? String(body.fullName) : null
    const loginUrl = String(body.loginUrl ?? `${new URL(req.url).origin}/m/login`)
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Look up by email in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email, full_name')
      .ilike('email', email)
      .maybeSingle()

    const password = generatePassword()
    let userId = existingProfile?.user_id as string | undefined

    if (!userId) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      })
      if (createErr) throw new Error(createErr.message)
      userId = created.user.id
      // handle_new_user trigger creates profile; update name if provided
      if (fullName) {
        await supabaseAdmin.from('profiles').update({ full_name: fullName }).eq('user_id', userId)
      }
    } else {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
      if (updErr) throw new Error(updErr.message)
      if (fullName && !existingProfile?.full_name) {
        await supabaseAdmin.from('profiles').update({ full_name: fullName }).eq('user_id', userId)
      }
    }

    // Ensure gym_coach role
    await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId!, role: 'gym_coach' }, { onConflict: 'user_id,role' })

    // Send welcome email
    const { data: emailRes, error: emailErr } = await supabaseAdmin.functions.invoke('send-welcome-email', {
      body: { email, fullName: fullName ?? undefined, password, role: 'gym_coach', loginUrl },
      headers: { Authorization: authHeader },
    })
    if (emailErr) throw new Error(emailErr.message)
    if (emailRes?.error) throw new Error(emailRes.error)

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('invite-coach error:', e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
