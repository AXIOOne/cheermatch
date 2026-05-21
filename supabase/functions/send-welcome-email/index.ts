import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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

    const { email, fullName, password, role, loginUrl, customSubject, customBodyHtml }: SendWelcomeEmailRequest = await req.json()

    if (!email || !password || !loginUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Sending welcome email to ${email}`)

    const roleText = role ? roleLabels[role] || role : null

    // Use custom subject if provided, otherwise use default
    const emailSubject = customSubject || 'Welcome to CheerMatch - Your Account Details'

    // Use custom HTML body if provided, otherwise use default template
    const emailHtml = customBodyHtml || `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background-color: #000000; padding: 32px; text-align: center;">
                    <img src="https://qzckpzwhkevqhwywlrkf.supabase.co/storage/v1/object/public/email-assets/logo-white.png" alt="CheerMatch" width="180" style="display: block; margin: 0 auto; max-width: 180px; height: auto;" />
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 32px;">
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 20px; font-weight: 600;">
                      Welcome${fullName ? ` ${fullName}` : ''}!
                    </h2>
                    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                      Your CheerMatch account has been created${roleText ? ` as a <strong>${roleText}</strong>` : ''}. Here are your login credentials:
                    </p>
                    
                    <!-- Credentials Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 12px; color: #3f3f46; font-size: 14px;">
                            <strong>Email:</strong> ${email}
                          </p>
                          <p style="margin: 0; color: #3f3f46; font-size: 14px;">
                            <strong>Password:</strong> ${password}
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 32px; color: #ef4444; font-size: 14px; line-height: 1.6;">
                      ⚠️ For security, please change your password after your first login.
                    </p>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${loginUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 32px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                            Log In Now
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 32px 0 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                      If the button doesn't work, copy and paste this link into your browser:
                      <br>
                      <a href="${loginUrl}" style="color: #2563eb; word-break: break-all;">${loginUrl}</a>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #fafafa; padding: 24px 32px; text-align: center;">
                    <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                      This is an automated message. Please do not reply to this email.
                      <br>
                      © ${new Date().getFullYear()} CheerMatch. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

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
