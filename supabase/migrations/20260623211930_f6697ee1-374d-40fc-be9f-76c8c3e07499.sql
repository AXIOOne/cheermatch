
ALTER TABLE public.video_submissions
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_info jsonb,
  ADD COLUMN IF NOT EXISTS submitted_via text NOT NULL DEFAULT 'web';

CREATE INDEX IF NOT EXISTS video_submissions_brightcove_video_id_idx
  ON public.video_submissions(brightcove_video_id);

CREATE INDEX IF NOT EXISTS teams_coach_user_id_idx
  ON public.teams(coach_user_id);
