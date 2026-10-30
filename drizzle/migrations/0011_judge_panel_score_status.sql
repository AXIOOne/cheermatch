CREATE OR REPLACE FUNCTION public.judge_panel_score_status()
RETURNS TABLE(submission_id uuid, panel_id uuid, status score_status, judge_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.submission_id, s.panel_id, s.status, s.judge_user_id
  FROM public.scores s
  JOIN public.video_submissions vs ON vs.id = s.submission_id
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.judge_assignments ja WHERE ja.judge_user_id = auth.uid() AND ja.event_id = vs.event_id);
$$;
REVOKE ALL ON FUNCTION public.judge_panel_score_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.judge_panel_score_status() TO authenticated;