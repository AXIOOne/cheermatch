-- Skills under a difficulty_driver field
CREATE TABLE public.scoring_field_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.scoring_fields(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scoring_field_skills_field_id_idx ON public.scoring_field_skills(field_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_field_skills TO authenticated;
GRANT ALL ON public.scoring_field_skills TO service_role;

ALTER TABLE public.scoring_field_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scoring field skills"
  ON public.scoring_field_skills FOR SELECT
  USING (true);

CREATE POLICY "Admins manage scoring field skills"
  ON public.scoring_field_skills FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_scoring_field_skills_updated_at
  BEFORE UPDATE ON public.scoring_field_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Radio options under each skill
CREATE TABLE public.scoring_field_skill_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.scoring_field_skills(id) ON DELETE CASCADE,
  label text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scoring_field_skill_options_skill_id_idx ON public.scoring_field_skill_options(skill_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_field_skill_options TO authenticated;
GRANT ALL ON public.scoring_field_skill_options TO service_role;

ALTER TABLE public.scoring_field_skill_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scoring field skill options"
  ON public.scoring_field_skill_options FOR SELECT
  USING (true);

CREATE POLICY "Admins manage scoring field skill options"
  ON public.scoring_field_skill_options FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- Judge selections per skill per score
CREATE TABLE public.score_skill_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.scoring_field_skills(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.scoring_field_skill_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (score_id, skill_id)
);
CREATE INDEX score_skill_selections_score_id_idx ON public.score_skill_selections(score_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_skill_selections TO authenticated;
GRANT ALL ON public.score_skill_selections TO service_role;

ALTER TABLE public.score_skill_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all skill selections"
  ON public.score_skill_selections FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Judges can view their own skill selections"
  ON public.score_skill_selections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.scores s
    WHERE s.id = score_skill_selections.score_id
      AND s.judge_user_id = auth.uid()
  ));

CREATE POLICY "Judges can manage their own skill selections"
  ON public.score_skill_selections FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.scores s
    WHERE s.id = score_skill_selections.score_id
      AND s.judge_user_id = auth.uid()
      AND s.status <> 'locked'::score_status
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scores s
    WHERE s.id = score_skill_selections.score_id
      AND s.judge_user_id = auth.uid()
      AND s.status <> 'locked'::score_status
  ));

CREATE POLICY "Admins can manage all skill selections"
  ON public.score_skill_selections FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));