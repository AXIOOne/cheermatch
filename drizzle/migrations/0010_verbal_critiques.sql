ALTER TABLE public.events ADD COLUMN IF NOT EXISTS verbal_critiques_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.verbal_critiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid NOT NULL UNIQUE REFERENCES public.scores(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.video_submissions(id) ON DELETE CASCADE,
  judge_user_id uuid NOT NULL,
  storage_path text NOT NULL,
  duration_seconds integer,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verbal_critiques TO authenticated;
GRANT ALL ON public.verbal_critiques TO service_role;
ALTER TABLE public.verbal_critiques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage critiques" ON public.verbal_critiques FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Judges manage own critiques" ON public.verbal_critiques FOR ALL TO authenticated
  USING (judge_user_id = auth.uid())
  WITH CHECK (judge_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.scores s WHERE s.id = score_id AND s.judge_user_id = auth.uid()));
CREATE TRIGGER verbal_critiques_updated_at BEFORE UPDATE ON public.verbal_critiques
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Judges upload own critique audio" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verbal-critiques' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Judges update own critique audio" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verbal-critiques' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Judges delete own critique audio" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verbal-critiques' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Read critique audio" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'verbal-critiques' AND (
    (auth.uid() IS NOT NULL AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')))
    OR EXISTS (SELECT 1 FROM public.verbal_critiques vc WHERE vc.storage_path = name)
  ));

CREATE OR REPLACE FUNCTION public.get_verbal_critiques(review_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(json_agg(json_build_object(
    'panel_name', coalesce(p.name, 'Judge'), 'panel_abbreviation', p.abbreviation,
    'storage_path', vc.storage_path, 'duration_seconds', vc.duration_seconds) ORDER BY p.display_order, p.name), '[]'::json)
  FROM public.scoring_review_tokens srt
  JOIN public.video_submissions vs ON vs.id = srt.submission_id
  JOIN public.events e ON e.id = vs.event_id AND e.verbal_critiques_enabled
  JOIN public.scores s ON s.submission_id = vs.id AND s.status = 'submitted'
  JOIN public.verbal_critiques vc ON vc.score_id = s.id
  LEFT JOIN public.judge_panels p ON p.id = s.panel_id
  WHERE srt.token = review_token;
$$;
GRANT EXECUTE ON FUNCTION public.get_verbal_critiques(text) TO anon, authenticated;