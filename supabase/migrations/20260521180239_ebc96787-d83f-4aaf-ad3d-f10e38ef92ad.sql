
CREATE TABLE public.team_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legacy_id bigint UNIQUE,
  level_number text,
  level_desc text,
  division_group text,
  division_uuid text,
  parent_division text,
  age_range text,
  class text,
  gender text,
  size text,
  division_url text,

  exclude_scores_from_vtv boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  international_level boolean NOT NULL DEFAULT false,
  is_non_tumbling boolean NOT NULL DEFAULT false,
  is_non_building boolean NOT NULL DEFAULT false,
  is_prep boolean NOT NULL DEFAULT false,
  is_world_level boolean NOT NULL DEFAULT false,
  is_iasf_level boolean NOT NULL DEFAULT false,
  is_international_global_level boolean NOT NULL DEFAULT false,
  varsity_novice_level boolean NOT NULL DEFAULT false,
  varsity_novice_tiny_level boolean NOT NULL DEFAULT false,
  hide_from_leaderboard boolean NOT NULL DEFAULT false,
  is_8_categories_level boolean NOT NULL DEFAULT false,
  use_icu_8_judge_scoring_template boolean NOT NULL DEFAULT false,
  hide_from_website boolean NOT NULL DEFAULT false,
  is_tiny boolean NOT NULL DEFAULT false,
  is_mini boolean NOT NULL DEFAULT false,
  is_youth boolean NOT NULL DEFAULT false,
  is_junior boolean NOT NULL DEFAULT false,
  international_united_scoring_level boolean NOT NULL DEFAULT false,
  is_crowd_leading boolean NOT NULL DEFAULT false,
  is_crowd_leading_non_tumbling boolean NOT NULL DEFAULT false,
  is_crowd_leading_non_building boolean NOT NULL DEFAULT false,
  is_school_performance boolean NOT NULL DEFAULT false,
  is_game_day boolean NOT NULL DEFAULT false,
  is_mascot boolean NOT NULL DEFAULT false,
  is_nda_game_day boolean NOT NULL DEFAULT false,
  is_nda_school_team_performance boolean NOT NULL DEFAULT false,
  is_nda_school_jazz boolean NOT NULL DEFAULT false,
  is_nda_school_pom boolean NOT NULL DEFAULT false,
  is_nda_school_hip_hop boolean NOT NULL DEFAULT false,
  is_nda_school_kick boolean NOT NULL DEFAULT false,
  is_nda_traditional_dance boolean NOT NULL DEFAULT false,
  is_nda_duo_trio boolean NOT NULL DEFAULT false,
  is_international_united_scoring boolean NOT NULL DEFAULT false,
  is_uca_performance_routine boolean NOT NULL DEFAULT false,
  is_uca_non_tumbling_routine boolean NOT NULL DEFAULT false,
  is_uca_intermediate_routine boolean NOT NULL DEFAULT false,
  is_uca_intermediate_non_tumbling_routine boolean NOT NULL DEFAULT false,
  is_uca_non_building_routine boolean NOT NULL DEFAULT false,
  is_uca_game_day boolean NOT NULL DEFAULT false,
  is_uca_uda_spirit_program boolean NOT NULL DEFAULT false,
  is_uda_traditional_execution boolean NOT NULL DEFAULT false,
  is_uda_traditional_choreography boolean NOT NULL DEFAULT false,
  is_uda_execution_kick boolean NOT NULL DEFAULT false,
  is_uda_choreography_kick boolean NOT NULL DEFAULT false,
  is_uda_traditional boolean NOT NULL DEFAULT false,
  is_uda_kick boolean NOT NULL DEFAULT false,
  is_uda_solo boolean NOT NULL DEFAULT false,
  is_uda_game_day boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_levels_division_group ON public.team_levels(division_group);
CREATE INDEX idx_team_levels_class ON public.team_levels(class);
CREATE INDEX idx_team_levels_level_number ON public.team_levels(level_number);
CREATE INDEX idx_team_levels_is_active ON public.team_levels(is_active);

ALTER TABLE public.team_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team levels"
  ON public.team_levels FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Judges and admins can view team levels"
  ON public.team_levels FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'judge'::app_role));

CREATE TRIGGER update_team_levels_updated_at
  BEFORE UPDATE ON public.team_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
