UPDATE public.teams
   SET athletes_female = female_count
 WHERE athletes_female = 0 AND female_count > 0;

UPDATE public.teams
   SET athletes_male = male_count
 WHERE athletes_male = 0 AND male_count > 0;

ALTER TABLE public.teams
  DROP COLUMN female_count,
  DROP COLUMN male_count;