-- Make levels and divisions universal (no event association)

-- Drop event-based RLS policies that reference event_id
DROP POLICY IF EXISTS "Anyone can view divisions of visible events" ON public.divisions;
DROP POLICY IF EXISTS "Anyone can view levels of visible events" ON public.levels;

-- Drop event_id columns
ALTER TABLE public.divisions DROP COLUMN IF EXISTS event_id;
ALTER TABLE public.levels DROP COLUMN IF EXISTS event_id;

-- New universal SELECT policies
CREATE POLICY "Anyone can view divisions"
ON public.divisions
FOR SELECT
USING (true);

CREATE POLICY "Anyone can view levels"
ON public.levels
FOR SELECT
USING (true);
