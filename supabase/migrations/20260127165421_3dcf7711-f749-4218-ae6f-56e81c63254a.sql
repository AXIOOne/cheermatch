-- Create email_templates table for storing customizable email templates
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  description text,
  template_type text NOT NULL DEFAULT 'review_link',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default review link template
INSERT INTO public.email_templates (name, subject, body_html, description, template_type, is_default)
VALUES (
  'Default Review Link',
  'Your Score Review is Ready - {{teamName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a1a; margin: 0;">CheerMatch</h1>
    </div>
    
    <h2 style="color: #333; margin-bottom: 20px;">Score Review Available</h2>
    
    <p style="color: #555; font-size: 16px; line-height: 1.6;">
      Dear {{coachName}},
    </p>
    
    <p style="color: #555; font-size: 16px; line-height: 1.6;">
      The scores for <strong>{{teamName}}</strong> from <strong>{{gymName}}</strong> are now available for review.
    </p>
    
    <p style="color: #555; font-size: 16px; line-height: 1.6;">
      Event: <strong>{{eventName}}</strong>
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{reviewUrl}}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        View Your Scores
      </a>
    </div>
    
    <p style="color: #888; font-size: 14px; line-height: 1.6;">
      This link will expire in 30 days. If you have any questions about your scores, you can request a detailed review through the portal.
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center;">
      This email was sent by CheerMatch. Please do not reply to this email.
    </p>
  </div>',
  'Default template for sending score review links to coaches',
  'review_link',
  true
);