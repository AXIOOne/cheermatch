CREATE TABLE public.accuscore_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.accuscore_forms TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.accuscore_forms TO authenticated;
GRANT ALL ON public.accuscore_forms TO service_role;
ALTER TABLE public.accuscore_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read accuscore forms" ON public.accuscore_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage accuscore forms" ON public.accuscore_forms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER accuscore_forms_updated_at BEFORE UPDATE ON public.accuscore_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_accuscore_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.accuscore_forms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, form_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_accuscore_forms TO authenticated;
GRANT ALL ON public.event_accuscore_forms TO service_role;
ALTER TABLE public.event_accuscore_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read event accuscore forms" ON public.event_accuscore_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage event accuscore forms" ON public.event_accuscore_forms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.accuscore_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.video_submissions(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  form_id uuid REFERENCES public.accuscore_forms(id) ON DELETE SET NULL,
  token_id uuid REFERENCES public.scoring_review_tokens(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  coach_email text,
  coach_name text,
  team_name text,
  gym_name text,
  division_name text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','honored','denied','duplicate')),
  admin_response text,
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accuscore_requests_event_idx ON public.accuscore_requests(event_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accuscore_requests TO authenticated;
GRANT ALL ON public.accuscore_requests TO service_role;
ALTER TABLE public.accuscore_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage accuscore requests" ON public.accuscore_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Starter general form (real forms added from uploaded PDFs)
INSERT INTO public.accuscore_forms (name, slug, description, fields, display_order) VALUES
('General Score Review', 'general', 'Request a review of any part of your score.',
 '[{"key":"area","label":"Area of score to review","type":"text","required":true},
   {"key":"time_in_routine","label":"Time in routine (mm:ss)","type":"time","required":false},
   {"key":"notes","label":"Explain what you would like reviewed","type":"textarea","required":true}]'::jsonb, 0);

-- Backfill legacy review requests
INSERT INTO public.accuscore_requests (event_id, submission_id, team_id, form_id, token_id, answers, coach_email, coach_name,
  team_name, gym_name, division_name, status, admin_response, created_at)
SELECT vs.event_id, vs.id, t.id, (SELECT id FROM public.accuscore_forms WHERE slug='general'), srt.id,
  jsonb_build_object('notes', coalesce(srt.review_notes, '')), srt.coach_email, srt.coach_name,
  t.name, t.gym_name, d.name,
  CASE WHEN srt.status = 'resolved' THEN 'honored' ELSE 'new' END,
  CASE WHEN srt.status = 'resolved' THEN 'Resolved (before AccuScore)' ELSE NULL END,
  coalesce(srt.requested_at, srt.created_at)
FROM public.scoring_review_tokens srt
JOIN public.video_submissions vs ON vs.id = srt.submission_id
LEFT JOIN public.teams t ON t.id = vs.team_id
LEFT JOIN public.divisions d ON d.id = t.division_id
WHERE srt.status IN ('review_requested','resolved');

CREATE OR REPLACE FUNCTION public.get_accuscore_context(review_token text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r json;
BEGIN
  SELECT json_build_object(
    'token_id', srt.id,
    'coach_email', srt.coach_email,
    'coach_name', srt.coach_name,
    'submission_id', vs.id,
    'event_id', e.id,
    'event_name', e.name,
    'team_name', t.name,
    'gym_name', t.gym_name,
    'division_name', d.name,
    'level_name', coalesce(l.name, dl.name),
    'cutoff_at', coalesce(e.accuscore_end_at, srt.expires_at),
    'is_open', (coalesce(e.accuscore_end_at, srt.expires_at) > now()) AND e.status::text <> 'archived',
    'forms', coalesce((
      SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'description', f.description, 'fields', f.fields) ORDER BY f.display_order, f.name)
      FROM public.event_accuscore_forms ef JOIN public.accuscore_forms f ON f.id = ef.form_id
      WHERE ef.event_id = e.id AND f.is_active), '[]'::json),
    'requests', coalesce((
      SELECT json_agg(json_build_object('id', ar.id, 'form_name', af.name, 'status', ar.status, 'created_at', ar.created_at, 'admin_response', ar.admin_response) ORDER BY ar.created_at DESC)
      FROM public.accuscore_requests ar LEFT JOIN public.accuscore_forms af ON af.id = ar.form_id
      WHERE ar.submission_id = vs.id), '[]'::json)
  ) INTO r
  FROM public.scoring_review_tokens srt
  JOIN public.video_submissions vs ON vs.id = srt.submission_id
  JOIN public.events e ON e.id = vs.event_id
  LEFT JOIN public.teams t ON t.id = vs.team_id
  LEFT JOIN public.divisions d ON d.id = t.division_id
  LEFT JOIN public.levels l ON l.id = t.level_id
  LEFT JOIN public.levels dl ON dl.id = d.level_id
  WHERE srt.token = review_token;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_accuscore_request(review_token text, _form_id uuid, _answers jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token public.scoring_review_tokens%ROWTYPE;
  v_sub public.video_submissions%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_div text;
  v_id uuid;
BEGIN
  SELECT * INTO v_token FROM public.scoring_review_tokens WHERE token = review_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid AccuScore link'; END IF;
  SELECT * INTO v_sub FROM public.video_submissions WHERE id = v_token.submission_id;
  SELECT * INTO v_event FROM public.events WHERE id = v_sub.event_id;
  IF coalesce(v_event.accuscore_end_at, v_token.expires_at) <= now() OR v_event.status::text = 'archived' THEN
    RAISE EXCEPTION 'The AccuScore window has closed. Scores are final.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_accuscore_forms ef JOIN public.accuscore_forms f ON f.id = ef.form_id
                 WHERE ef.event_id = v_event.id AND ef.form_id = _form_id AND f.is_active) THEN
    RAISE EXCEPTION 'This form is not available for this event';
  END IF;
  IF _answers IS NULL OR jsonb_typeof(_answers) <> 'object' OR length(_answers::text) > 20000 THEN
    RAISE EXCEPTION 'Invalid answers';
  END IF;
  SELECT * INTO v_team FROM public.teams WHERE id = v_sub.team_id;
  SELECT name INTO v_div FROM public.divisions WHERE id = v_team.division_id;
  INSERT INTO public.accuscore_requests (event_id, submission_id, team_id, form_id, token_id, answers, coach_email, coach_name, team_name, gym_name, division_name)
  VALUES (v_event.id, v_sub.id, v_team.id, _form_id, v_token.id, _answers, v_token.coach_email, v_token.coach_name, v_team.name, v_team.gym_name, v_div)
  RETURNING id INTO v_id;
  UPDATE public.scoring_review_tokens SET status = 'review_requested', requested_at = now() WHERE id = v_token.id;
  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_accuscore_context(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_accuscore_request(text, uuid, jsonb) TO anon, authenticated;