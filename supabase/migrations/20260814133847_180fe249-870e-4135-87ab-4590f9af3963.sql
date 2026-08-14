ALTER TABLE public.divisions DROP CONSTRAINT IF EXISTS divisions_level_check;
ALTER TABLE public.divisions ADD CONSTRAINT divisions_level_check CHECK (
  level IS NULL OR level = ANY (ARRAY['Level 1','Level 2','Level 3','Level 4','Level 4.2','Level 5','Level 6','Level 7','Prep','Novice','Tiny Novice'])
);