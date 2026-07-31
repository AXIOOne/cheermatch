import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
}

type Row = {
  team_name: string
  gym_name: string
  division_id: string
  level_id: string
  athletes_male: number
  athletes_female: number
  coach_name: string | null
  coach_email: string
  coach_phone: string | null
  coach_password: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No authorization header' }, 401)

    const { data: { user: requester }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !requester) return json({ error: 'Invalid authentication' }, 401)

    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: requester.id, _role: 'admin' })
    if (!isAdmin) return json({ error: 'Unauthorized - Admin access required' }, 403)

    const { eventId, rows } = await req.json() as { eventId: string; rows: Row[] }
    if (!eventId || !Array.isArray(rows) || rows.length === 0) {
      return json({ error: 'eventId and rows are required' }, 400)
    }

    const summary = {
      teamsImported: 0,
      organizationsCreated: 0,
      coachesCreated: 0,
      coachPasswordsReset: 0,
      failures: [] as { row: string; message: string }[],
    }

    // ---- Organizations -------------------------------------------------
    const { data: existingOrgs, error: orgErr } = await admin.from('organizations').select('id, name')
    if (orgErr) return json({ error: orgErr.message }, 400)

    const orgByName = new Map<string, string>()
    for (const o of existingOrgs ?? []) orgByName.set(String(o.name).trim().toLowerCase(), o.id)

    const neededOrgs = new Map<string, string>() // key -> display name
    for (const r of rows) {
      const key = (r.gym_name || '').trim().toLowerCase()
      if (key && !orgByName.has(key)) neededOrgs.set(key, r.gym_name.trim())
    }

    if (neededOrgs.size > 0) {
      const { data: created, error: createOrgErr } = await admin
        .from('organizations')
        .insert([...neededOrgs.values()].map((name) => ({ name, is_active: true })))
        .select('id, name')
      if (createOrgErr) return json({ error: `Failed creating organizations: ${createOrgErr.message}` }, 400)
      for (const o of created ?? []) orgByName.set(String(o.name).trim().toLowerCase(), o.id)
      summary.organizationsCreated = created?.length ?? 0
    }

    // ---- Coaches -------------------------------------------------------
    const coachEmails = [...new Set(rows.map((r) => r.coach_email.trim().toLowerCase()).filter(Boolean))]
    const coachUserIdByEmail = new Map<string, string>()

    const { data: existingProfiles } = await admin
      .from('profiles')
      .select('user_id, email')
      .in('email', coachEmails)
    const existingByEmail = new Map<string, string>()
    for (const p of existingProfiles ?? []) {
      if (p.email) existingByEmail.set(String(p.email).trim().toLowerCase(), p.user_id)
    }

    for (const email of coachEmails) {
      const row = rows.find((r) => r.coach_email.trim().toLowerCase() === email)!
      const orgId = orgByName.get((row.gym_name || '').trim().toLowerCase()) ?? null
      const password = row.coach_password

      try {
        let userId = existingByEmail.get(email) ?? null

        if (!userId) {
          const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: row.coach_name ?? undefined },
          })
          if (createErr || !newUser?.user) throw new Error(createErr?.message || 'Failed to create user')
          userId = newUser.user.id
          summary.coachesCreated++
        } else {
          const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password })
          if (updErr) throw new Error(updErr.message)
          summary.coachPasswordsReset++
        }

        // Sync profile (name, org, password hash used by the mobile login flow)
        const profileUpdates: Record<string, unknown> = { organization_id: orgId }
        if (row.coach_name) profileUpdates.full_name = row.coach_name
        const { data: hashed } = await admin.rpc('hash_password', { _password: password })
        if (typeof hashed === 'string') profileUpdates.password_hash = hashed
        await admin.from('profiles').update(profileUpdates).eq('user_id', userId)

        // Ensure gym_coach role
        const { data: roleRows } = await admin
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'gym_coach')
        if (!roleRows || roleRows.length === 0) {
          await admin.from('user_roles').insert({ user_id: userId, role: 'gym_coach' })
        }

        coachUserIdByEmail.set(email, userId)
      } catch (e) {
        summary.failures.push({ row: email, message: e instanceof Error ? e.message : 'Coach setup failed' })
      }
    }

    // ---- Teams ---------------------------------------------------------
    const teamPayload = rows.map((r) => {
      const email = r.coach_email.trim().toLowerCase()
      return {
        event_id: eventId,
        name: r.team_name,
        gym_name: r.gym_name,
        division_id: r.division_id,
        level_id: r.level_id,
        athletes_male: r.athletes_male,
        athletes_female: r.athletes_female,
        coach_name: r.coach_name,
        coach_email: email,
        coach_phone: r.coach_phone,
        organization_id: orgByName.get((r.gym_name || '').trim().toLowerCase()) ?? null,
        coach_user_id: coachUserIdByEmail.get(email) ?? null,
      }
    })

    const { data: insertedTeams, error: teamErr } = await admin.from('teams').insert(teamPayload).select('id')
    if (teamErr) return json({ error: `Failed importing teams: ${teamErr.message}`, summary }, 400)
    summary.teamsImported = insertedTeams?.length ?? 0

    return json({ success: true, summary })
  } catch (error) {
    console.error('import-registrations error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
