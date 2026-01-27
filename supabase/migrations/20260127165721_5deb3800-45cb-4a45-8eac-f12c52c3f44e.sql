-- Insert default welcome email template
INSERT INTO public.email_templates (name, subject, body_html, description, template_type, is_default)
VALUES (
  'Default Welcome Email',
  'Welcome to CheerMatch - Your Account Details',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px; background-color: #000000; padding: 32px; border-radius: 12px 12px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">CheerMatch</h1>
    </div>
    
    <div style="padding: 40px 32px; background-color: #ffffff; border: 1px solid #e5e5e5; border-top: none;">
      <h2 style="color: #18181b; margin: 0 0 16px; font-size: 20px; font-weight: 600;">
        Welcome{{fullName}}!
      </h2>
      
      <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
        Your CheerMatch account has been created{{roleText}}. Here are your login credentials:
      </p>
      
      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 12px; color: #3f3f46; font-size: 14px;">
          <strong>Email:</strong> {{email}}
        </p>
        <p style="margin: 0; color: #3f3f46; font-size: 14px;">
          <strong>Password:</strong> {{password}}
        </p>
      </div>
      
      <p style="color: #ef4444; font-size: 14px; line-height: 1.6; margin: 0 0 32px;">
        ⚠️ For security, please change your password after your first login.
      </p>
      
      <div style="text-align: center;">
        <a href="{{loginUrl}}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 32px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">
          Log In Now
        </a>
      </div>
      
      <p style="margin: 32px 0 0; color: #71717a; font-size: 14px; line-height: 1.6;">
        If the button doesn''t work, copy and paste this link into your browser:
        <br>
        <a href="{{loginUrl}}" style="color: #2563eb; word-break: break-all;">{{loginUrl}}</a>
      </p>
    </div>
    
    <div style="background-color: #fafafa; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e5; border-top: none;">
      <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
        This is an automated message. Please do not reply to this email.
        <br>
        © 2026 CheerMatch. All rights reserved.
      </p>
    </div>
  </div>',
  'Default template for welcoming new users with their login credentials',
  'welcome',
  true
);