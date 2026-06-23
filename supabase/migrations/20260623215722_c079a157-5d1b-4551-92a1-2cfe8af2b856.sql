
ALTER TABLE public.teams
  ALTER COLUMN coach_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS coach_name text,
  ADD COLUMN IF NOT EXISTS coach_email text,
  ADD COLUMN IF NOT EXISTS coach_phone text,
  ADD COLUMN IF NOT EXISTS athletes_male integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS athletes_female integer NOT NULL DEFAULT 0;
