ALTER TABLE public.video_submissions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS status_before_archive submission_status;

CREATE INDEX IF NOT EXISTS idx_video_submissions_event_archived
  ON public.video_submissions (event_id, archived_at);

DROP POLICY IF EXISTS "Admins can delete submissions" ON public.video_submissions;
CREATE POLICY "Admins can delete submissions"
  ON public.video_submissions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));