CREATE TABLE public.judge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  created_by uuid NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.judge_messages TO authenticated;
GRANT ALL ON public.judge_messages TO service_role;
ALTER TABLE public.judge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage judge messages"
ON public.judge_messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Judges view their messages"
ON public.judge_messages FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'judge') AND (
    event_id IS NULL OR EXISTS (
      SELECT 1 FROM public.judge_assignments ja
      WHERE ja.event_id = judge_messages.event_id
        AND ja.judge_user_id = auth.uid()
    )
  )
);

CREATE TABLE public.judge_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.judge_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.judge_message_reads TO authenticated;
GRANT ALL ON public.judge_message_reads TO service_role;
ALTER TABLE public.judge_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own message reads"
ON public.judge_message_reads FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view message reads"
ON public.judge_message_reads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_messages;