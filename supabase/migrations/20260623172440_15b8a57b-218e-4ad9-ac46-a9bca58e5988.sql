DROP POLICY IF EXISTS "Judges can update their own non-locked scores" ON public.scores;

CREATE POLICY "Judges can update their own in-progress scores"
ON public.scores
FOR UPDATE
TO authenticated
USING (
  judge_user_id = auth.uid()
  AND status = 'in_progress'::score_status
)
WITH CHECK (
  judge_user_id = auth.uid()
  AND status IN ('in_progress'::score_status, 'submitted'::score_status)
);