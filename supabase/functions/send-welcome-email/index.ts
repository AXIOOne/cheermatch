import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { welcomeEmailHtml, welcomeEmailSubject, coachWelcomeEmailHtml, coachWelcomeEmailSubject, resolveEmailSubject, EMAIL_SUBJECTS_SETTINGS_KEY } from '../_shared/email-layouts.ts'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // supabase-js may send additional x-supabase-* headers; include them to avoid CORS preflight failures
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
}

interface SendWelcomeEmailRequest {
  email: string;
  fullName?: string;
  password: string;
  role?: string;
  loginUrl: string;
  customSubject?: string;
  customBodyHtml?: string;
  gymName?: string | null;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  judge: 'Judge',
  gym_coach: 'Gym Coach',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      throw new Error('Email service not configured')
    }

    const resend = new Resend(resendApiKey)

    // Verify the requesting user is an admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !requestingUser) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: requestingUser.id,
      _role: 'admin'
    })

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { email, fullName, password, role, loginUrl, customSubject, customBodyHtml, gymName }: SendWelcomeEmailRequest = await req.json()

    if (!email || !password || !loginUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Sending welcome email to ${email}`)

    const roleText = role ? roleLabels[role] || role : null

    // Gym coaches get their own dedicated email; the standard welcome layout
    // (and any custom welcome template) is for admins, portal admins, judges.
    const isCoach = role === 'gym_coach'

    // Admin-editable subject overrides (platform_settings: email_subjects)
    const { data: subjRow } = await supabaseAdmin
      .from('platform_settings').select('value').eq('key', EMAIL_SUBJECTS_SETTINGS_KEY).maybeSingle()
    const subjectOverrides = (subjRow?.value ?? null) as Record<string, string> | null

    const emailSubject = customSubject || resolveEmailSubject(
      subjectOverrides,
      isCoach ? 'coach_welcome' : 'welcome',
      isCoach ? coachWelcomeEmailSubject : welcomeEmailSubject,
      { fullName, email, gymName: gymName ?? undefined },
    )

    const emailHtml = customBodyHtml || (isCoach
      ? coachWelcomeEmailHtml({ fullName, email, password, loginUrl, gymName })
      : welcomeEmailHtml({ fullName, email, password, roleText, loginUrl }))

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'CheerMatch <noreply@cheermatch.com>',
      to: [email],
      bcc: ['paul@cheermatch.com'],
      subject: emailSubject,
      html: emailHtml,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      throw new Error(emailError.message || 'Failed to send email')
    }

    console.log('Welcome email sent successfully:', emailData)

    return new Response(JSON.stringify({ success: true, messageId: emailData?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error sending welcome email:', error)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
