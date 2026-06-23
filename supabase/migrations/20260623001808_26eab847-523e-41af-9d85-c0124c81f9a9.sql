ALTER TABLE public.scoring_categories ADD COLUMN IF NOT EXISTS panel_abbreviation TEXT;
ALTER TABLE public.scoring_sections ADD COLUMN IF NOT EXISTS default_panel_abbreviation TEXT;