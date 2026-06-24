ALTER TABLE public.teams
  ADD COLUMN female_count integer NOT NULL DEFAULT 0,
  ADD COLUMN male_count integer NOT NULL DEFAULT 0;

UPDATE public.teams SET female_count = COALESCE(athlete_count, 0);

ALTER TABLE public.teams DROP COLUMN athlete_count;