ALTER TABLE public.events DROP COLUMN IF EXISTS registration_deadline;
ALTER TABLE public.events DROP COLUMN IF EXISTS broadcast_deadline;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'America/New_York';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS discipline text;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_discipline_check;
ALTER TABLE public.events ADD CONSTRAINT events_discipline_check CHECK (discipline IS NULL OR discipline IN ('allstar_cheer','allstar_dance','nca_cheer','nca_dance','uca_cheer','uca_dance','usa_cheer','usa_dance'));