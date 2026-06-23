
-- 1) Wipe all existing scoring data (fresh start per approved plan)
DELETE FROM public.score_deductions;
DELETE FROM public.score_details;
DELETE FROM public.scores;
DELETE FROM public.scoring_categories;
DELETE FROM public.scoring_sections;
DELETE FROM public.deduction_types;
DELETE FROM public.scoring_templates;

-- 2) Drop the legacy category model
DROP TABLE IF EXISTS public.scoring_categories CASCADE;
ALTER TABLE public.score_details DROP COLUMN IF EXISTS category_id;

-- 3) Field type enum + aggregation enum
DO $$ BEGIN
  CREATE TYPE public.scoring_field_type AS ENUM ('number', 'dropdown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.scoring_field_aggregation AS ENUM ('average','trimmed_mean','min','max','sum');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) scoring_fields — the columns of the scoresheet row
CREATE TABLE public.scoring_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.scoring_templates(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.scoring_sections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  field_type public.scoring_field_type NOT NULL DEFAULT 'number',
  min_value numeric NOT NULL DEFAULT 0,
  max_value numeric NOT NULL DEFAULT 10,
  step numeric NOT NULL DEFAULT 0.25,
  max_points numeric NOT NULL DEFAULT 10,
  aggregation public.scoring_field_aggregation NOT NULL DEFAULT 'average',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_fields TO authenticated;
GRANT SELECT ON public.scoring_fields TO anon;
GRANT ALL ON public.scoring_fields TO service_role;
ALTER TABLE public.scoring_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scoring fields" ON public.scoring_fields FOR SELECT USING (true);
CREATE POLICY "Admins manage scoring fields" ON public.scoring_fields FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_scoring_fields_updated_at BEFORE UPDATE ON public.scoring_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_scoring_fields_section ON public.scoring_fields(section_id);
CREATE INDEX idx_scoring_fields_template ON public.scoring_fields(template_id);

-- 5) scoring_field_options — dropdown options
CREATE TABLE public.scoring_field_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.scoring_fields(id) ON DELETE CASCADE,
  label text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_field_options TO authenticated;
GRANT SELECT ON public.scoring_field_options TO anon;
GRANT ALL ON public.scoring_field_options TO service_role;
ALTER TABLE public.scoring_field_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scoring field options" ON public.scoring_field_options FOR SELECT USING (true);
CREATE POLICY "Admins manage scoring field options" ON public.scoring_field_options FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_scoring_field_options_field ON public.scoring_field_options(field_id);

-- 6) scoring_field_panels — which panel abbreviations own each field
CREATE TABLE public.scoring_field_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.scoring_fields(id) ON DELETE CASCADE,
  panel_abbreviation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_id, panel_abbreviation)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_field_panels TO authenticated;
GRANT SELECT ON public.scoring_field_panels TO anon;
GRANT ALL ON public.scoring_field_panels TO service_role;
ALTER TABLE public.scoring_field_panels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scoring field panels" ON public.scoring_field_panels FOR SELECT USING (true);
CREATE POLICY "Admins manage scoring field panels" ON public.scoring_field_panels FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_scoring_field_panels_field ON public.scoring_field_panels(field_id);
CREATE INDEX idx_scoring_field_panels_abbrev ON public.scoring_field_panels(panel_abbreviation);

-- 7) score_details now keys on field_id
ALTER TABLE public.score_details
  ADD COLUMN field_id uuid NOT NULL REFERENCES public.scoring_fields(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX idx_score_details_score_field ON public.score_details(score_id, field_id);

-- 8) Update get_review_by_token RPC to use scoring_fields
CREATE OR REPLACE FUNCTION public.get_review_by_token(review_token text)
RETURNS TABLE(token_id uuid, token_status text, coach_email text, coach_name text, expires_at timestamptz, team_name text, gym_name text, division_name text, level_name text, event_name text, video_url text, thumbnail_url text, submission_status text, scores json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    srt.id, srt.status, srt.coach_email, srt.coach_name, srt.expires_at,
    t.name, t.gym_name, d.name, l.name, e.name,
    vs.video_url, vs.thumbnail_url, vs.status::text,
    (
      SELECT json_agg(json_build_object(
        'score_id', s.id,
        'total_score', s.total_score,
        'deductions', s.deductions,
        'comments', s.comments,
        'submitted_at', s.submitted_at,
        'fields', (
          SELECT json_agg(json_build_object(
            'name', sf.name,
            'points', sd.points,
            'max_points', sf.max_points,
            'section_name', ss.name
          ) ORDER BY ss.display_order, sf.display_order)
          FROM score_details sd
          JOIN scoring_fields sf ON sf.id = sd.field_id
          JOIN scoring_sections ss ON ss.id = sf.section_id
          WHERE sd.score_id = s.id
        )
      ))
      FROM scores s WHERE s.submission_id = vs.id AND s.status = 'submitted'
    ) as scores
  FROM scoring_review_tokens srt
  JOIN video_submissions vs ON vs.id = srt.submission_id
  JOIN teams t ON t.id = vs.team_id
  JOIN divisions d ON d.id = t.division_id
  JOIN levels l ON l.id = t.level_id
  JOIN events e ON e.id = vs.event_id
  WHERE srt.token = review_token AND srt.expires_at > now();
END;
$function$;
