CREATE TABLE public.score_field_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.scoring_fields(id) ON DELETE CASCADE,
  original_points numeric,
  new_points numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  overridden_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (score_id, field_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_field_overrides TO authenticated;
GRANT ALL ON public.score_field_overrides TO service_role;

ALTER TABLE public.score_field_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view overrides"
  ON public.score_field_overrides FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert overrides"
  ON public.score_field_overrides FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND overridden_by = auth.uid());

CREATE POLICY "Admins can delete overrides"
  ON public.score_field_overrides FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_score_field_overrides_score ON public.score_field_overrides(score_id);