-- Detach (not delete) video submissions when their registration (team) is deleted
ALTER TABLE public.video_submissions DROP CONSTRAINT video_submissions_team_id_fkey;
ALTER TABLE public.video_submissions ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE public.video_submissions
  ADD CONSTRAINT video_submissions_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;