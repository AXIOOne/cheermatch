DROP POLICY IF EXISTS "Authenticated read accuscore forms" ON public.accuscore_forms;
DROP POLICY IF EXISTS "Authenticated read event accuscore forms" ON public.event_accuscore_forms;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accuscore_forms, public.event_accuscore_forms TO authenticated;
GRANT ALL ON public.accuscore_forms, public.event_accuscore_forms TO service_role;
REVOKE ALL ON public.accuscore_forms, public.event_accuscore_forms FROM anon;
DROP POLICY IF EXISTS "Read critique audio" ON storage.objects;
CREATE POLICY "Read critique audio" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'verbal-critiques'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'judge'::public.app_role)
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);