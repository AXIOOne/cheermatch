import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
}

interface ResendInviteRequest {
  userId: string;
  loginUrl: string;
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: requestingUser.id, _role: 'admin'
    })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { userId, loginUrl }: ResendInviteRequest = await req.json()
    if (!userId || !loginUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user info
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (getUserError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('full_name').eq('user_id', userId).maybeSingle()

    const { data: roleRow } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', userId).limit(1).maybeSingle()

    // Generate new temporary password and update
    const newPassword = generatePassword()
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })
    if (updateError) throw new Error(updateError.message)

    // Invoke send-welcome-email
    const { data: emailRes, error: emailErr } = await supabaseAdmin.functions.invoke('send-welcome-email', {
      body: {
        email: userData.user.email,
        fullName: profile?.full_name ?? undefined,
        password: newPassword,
        role: roleRow?.role,
        loginUrl,
      },
      headers: { Authorization: authHeader },
    })

    if (emailErr) throw new Error(emailErr.message)
    if (emailRes?.error) throw new Error(emailRes.error)

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error'
    console.error('resend-user-invite error:', error)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
