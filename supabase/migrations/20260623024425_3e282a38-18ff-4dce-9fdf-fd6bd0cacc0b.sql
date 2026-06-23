ALTER TABLE public.divisions DROP CONSTRAINT IF EXISTS divisions_discipline_check;
UPDATE public.divisions SET discipline = 'allstar_cheer' WHERE discipline = 'cheer';
UPDATE public.divisions SET discipline = 'allstar_dance' WHERE discipline = 'dance';
ALTER TABLE public.divisions ALTER COLUMN discipline SET DEFAULT 'allstar_cheer';
ALTER TABLE public.divisions ADD CONSTRAINT divisions_discipline_check CHECK (discipline IN ('allstar_cheer','allstar_dance','nca_cheer','nca_dance','uca_cheer','uca_dance','usa_cheer','usa_dance'));
UPDATE public.divisions SET level = NULL WHERE discipline <> 'allstar_cheer';