import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { reviewEmailHtml, reviewEmailSubject } from '../_shared/email-layouts.ts'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendReviewEmailRequest {
  coachEmail: string;
  coachName?: string;
  teamName: string;
  gymName?: string;
  eventName: string;
  reviewUrl: string;
  customSubject?: string;
  customBodyHtml?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Parse request body
    const { 
      coachEmail, 
      coachName, 
      teamName, 
      gymName,
      eventName, 
      reviewUrl,
      customSubject,
      customBodyHtml
    }: SendReviewEmailRequest = await req.json()

    if (!coachEmail || !teamName || !reviewUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Sending review email to ${coachEmail} for team ${teamName}`)

    // Use custom subject if provided, otherwise use default
    const emailSubject = customSubject || reviewEmailSubject(teamName, eventName)

    const emailHtml = customBodyHtml || reviewEmailHtml({ coachName, teamName, gymName, eventName, reviewUrl })

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'CheerMatch <noreply@cheermatch.com>',
      to: [coachEmail],
      subject: emailSubject,
      html: emailHtml,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      throw new Error(emailError.message || 'Failed to send email')
    }

    console.log('Email sent successfully:', emailData)

    return new Response(JSON.stringify({ success: true, messageId: emailData?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error sending email:', error)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
