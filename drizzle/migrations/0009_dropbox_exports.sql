CREATE TABLE public.dropbox_connection (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  refresh_token text NOT NULL,
  account_email text,
  base_folder text NOT NULL DEFAULT '/CheerMatch Videos',
  connected_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dropbox_connection TO service_role;
ALTER TABLE public.dropbox_connection ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dropbox_exports (
  submission_id uuid PRIMARY KEY REFERENCES public.video_submissions(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  dropbox_path text,
  status text NOT NULL DEFAULT 'queued',
  job_id text,
  error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dropbox_exports TO authenticated;
GRANT ALL ON public.dropbox_exports TO service_role;
ALTER TABLE public.dropbox_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read dropbox exports" ON public.dropbox_exports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX dropbox_exports_event_idx ON public.dropbox_exports(event_id);