-- Create platform_settings table for storing admin settings
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all settings
CREATE POLICY "Admins can view platform settings"
ON public.platform_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('security', '{"minPasswordLength": 8, "requireSpecialChars": true, "sessionTimeoutHours": 24}'::jsonb),
  ('notifications', '{"emailOnSubmission": true, "emailOnReview": true, "emailOnScoring": false}'::jsonb),
  ('integrations', '{"brightcoveAccountId": "", "brightcoveApiKey": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;