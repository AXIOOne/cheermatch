ALTER TABLE public.scores DROP CONSTRAINT scores_submission_id_judge_user_id_key;
ALTER TABLE public.scores ADD CONSTRAINT scores_submission_judge_panel_key UNIQUE (submission_id, judge_user_id, panel_id);
CREATE UNIQUE INDEX scores_submission_judge_without_panel_key ON public.scores (submission_id, judge_user_id) WHERE panel_id IS NULL;
COMMENT ON CONSTRAINT scores_submission_judge_panel_key ON public.scores IS 'One score per author per submission per panel; the same author may save separate panels.';