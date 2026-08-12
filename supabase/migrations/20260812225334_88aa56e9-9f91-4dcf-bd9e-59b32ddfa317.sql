ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON public.profiles (last_seen_at DESC);
