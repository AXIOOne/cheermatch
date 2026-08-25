ALTER TABLE public.capture_attempts
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE POLICY "Admins can update capture attempts"
ON public.capture_attempts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete capture attempts"
ON public.capture_attempts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));