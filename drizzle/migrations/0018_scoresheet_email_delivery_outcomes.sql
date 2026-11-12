CREATE TABLE public.scoresheet_email_deliveries (
 submission_id uuid PRIMARY KEY REFERENCES public.video_submissions(id) ON DELETE CASCADE,
 email_id text,
 attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','delivered','delayed','failed','bounced','complained','unknown')),
 error text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 checked_at timestamptz
);
GRANT SELECT ON public.scoresheet_email_deliveries TO authenticated;
GRANT ALL ON public.scoresheet_email_deliveries TO service_role;
ALTER TABLE public.scoresheet_email_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read scoresheet delivery outcomes" ON public.scoresheet_email_deliveries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.scoresheet_email_deliveries IS 'Service-written send attempts and provider delivery outcomes; a receipt means accepted, not delivered.';