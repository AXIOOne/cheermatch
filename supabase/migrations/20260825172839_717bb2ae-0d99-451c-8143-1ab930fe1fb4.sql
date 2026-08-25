CREATE TABLE public.capture_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid,
  attempt_number integer NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'recording',
  duration_seconds integer,
  device_info jsonb,
  submission_id uuid REFERENCES public.video_submissions(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, team_id, attempt_number)
);

GRANT SELECT ON public.capture_attempts TO authenticated;
GRANT ALL ON public.capture_attempts TO service_role;

ALTER TABLE public.capture_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all capture attempts"
ON public.capture_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'portal_admin') OR public.has_role(auth.uid(), 'judge'));

CREATE POLICY "Coaches can view attempts for their teams"
ON public.capture_attempts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teams t
  JOIN public.profiles p ON p.user_id = auth.uid()
  WHERE t.id = capture_attempts.team_id
    AND (t.coach_user_id = auth.uid() OR lower(t.coach_email) = lower(p.email))
));

CREATE INDEX idx_capture_attempts_event_team ON public.capture_attempts (event_id, team_id);

CREATE TRIGGER update_capture_attempts_updated_at
BEFORE UPDATE ON public.capture_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();