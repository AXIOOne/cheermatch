
ALTER TABLE public.divisions
  ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'cheer',
  ADD COLUMN IF NOT EXISTS level text;

ALTER TABLE public.divisions
  DROP CONSTRAINT IF EXISTS divisions_discipline_check;
ALTER TABLE public.divisions
  ADD CONSTRAINT divisions_discipline_check CHECK (discipline IN ('cheer','dance'));

ALTER TABLE public.divisions
  DROP CONSTRAINT IF EXISTS divisions_level_check;
ALTER TABLE public.divisions
  ADD CONSTRAINT divisions_level_check CHECK (
    level IS NULL OR level IN ('Level 1','Level 2','Level 3','Level 4','Level 4.2','Level 5','Level 6')
  );
