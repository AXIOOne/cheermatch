ALTER TABLE public.scores ADD COLUMN admin_saved_by uuid;
COMMENT ON COLUMN public.scores.admin_saved_by IS 'Trusted admin whole-panel override provenance; assigned judge identity may remain the score author.';
CREATE OR REPLACE FUNCTION public.stamp_admin_score_save() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    NEW.admin_saved_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.admin_saved_by := OLD.admin_saved_by;
  ELSE
    NEW.admin_saved_by := NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stamp_admin_score_save BEFORE INSERT OR UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION public.stamp_admin_score_save();
CREATE OR REPLACE FUNCTION public.judge_panel_score_status()
RETURNS TABLE(submission_id uuid, panel_id uuid, status score_status, judge_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.submission_id, s.panel_id, s.status, s.judge_user_id
  FROM public.scores s JOIN public.video_submissions vs ON vs.id = s.submission_id
  WHERE auth.uid() IS NOT NULL
    AND (s.judge_user_id = auth.uid() OR s.admin_saved_by IS NOT NULL OR public.has_role(s.judge_user_id, 'admin'))
    AND EXISTS (SELECT 1 FROM public.judge_assignments ja WHERE ja.judge_user_id = auth.uid() AND ja.event_id = vs.event_id);
$$;
REVOKE ALL ON FUNCTION public.judge_panel_score_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.judge_panel_score_status() TO authenticated;
CREATE TABLE public.scoresheet_email_receipts (
  submission_id uuid PRIMARY KEY REFERENCES public.video_submissions(id) ON DELETE CASCADE,
  email_id text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scoresheet_email_receipts TO authenticated;
GRANT ALL ON public.scoresheet_email_receipts TO service_role;
ALTER TABLE public.scoresheet_email_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read scoresheet email receipts" ON public.scoresheet_email_receipts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.get_coach_performance(review_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT json_build_object(
  'video_url', vs.video_url, 'thumbnail_url', vs.thumbnail_url, 'status', vs.status,
  'scores', coalesce((SELECT json_agg(json_build_object(
    'score_id', s.id, 'panel_name', coalesce(jp.name, 'Judge'),
    'total_score', s.total_score, 'deductions', s.deductions,
    'comments', CASE WHEN st.show_comments_on_scoresheet THEN s.comments ELSE NULL END,
    'fields', coalesce((SELECT json_agg(json_build_object(
      'name', sf.name, 'points', coalesce((SELECT o.new_points FROM public.score_field_overrides o WHERE o.score_id=s.id AND o.field_id=sf.id ORDER BY o.created_at DESC LIMIT 1), sd.points),
      'max_points', sf.max_points, 'section_name', ss.name
    ) ORDER BY ss.display_order, sf.display_order)
    FROM public.score_details sd JOIN public.scoring_fields sf ON sf.id=sd.field_id
    JOIN public.scoring_sections ss ON ss.id=sf.section_id WHERE sd.score_id=s.id), '[]'::json)
  ) ORDER BY jp.display_order, s.created_at)
  FROM public.scores s LEFT JOIN public.judge_panels jp ON jp.id=s.panel_id
  LEFT JOIN public.scoring_templates st ON st.id=s.template_id
  WHERE s.submission_id=vs.id AND s.status IN ('submitted','locked')), '[]'::json)
)
FROM public.scoring_review_tokens rt JOIN public.video_submissions vs ON vs.id=rt.submission_id
WHERE rt.token=review_token;
$$;
REVOKE ALL ON FUNCTION public.get_coach_performance(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_coach_performance(text) TO anon, authenticated;