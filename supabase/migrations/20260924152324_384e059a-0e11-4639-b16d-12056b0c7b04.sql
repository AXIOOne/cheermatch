DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
CREATE POLICY "Admins or members can view organizations"
ON public.organizations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'portal_admin'::app_role)
  OR id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);