CREATE TABLE public.coach_invite_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  coach_email text NOT NULL,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_invite_sends_event_idx ON public.coach_invite_sends(event_id, coach_email);
GRANT SELECT ON public.coach_invite_sends TO authenticated;
GRANT ALL ON public.coach_invite_sends TO service_role;
ALTER TABLE public.coach_invite_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view coach invite sends" ON public.coach_invite_sends FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));