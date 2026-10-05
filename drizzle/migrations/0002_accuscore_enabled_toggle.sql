ALTER TABLE public.events ADD COLUMN IF NOT EXISTS accuscore_enabled boolean NOT NULL DEFAULT true;

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
    'accuscore_enabled', e.accuscore_enabled,
    'is_open', e.accuscore_enabled AND (coalesce(e.accuscore_end_at, srt.expires_at) > now()) AND e.status::text <> 'archived',
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
  IF NOT v_event.accuscore_enabled THEN
    RAISE EXCEPTION 'AccuScore is not available for this event';
  END IF;
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