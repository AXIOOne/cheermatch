ALTER TABLE public.scores
ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scores_needs_review ON public.scores(needs_review) WHERE needs_review = true;