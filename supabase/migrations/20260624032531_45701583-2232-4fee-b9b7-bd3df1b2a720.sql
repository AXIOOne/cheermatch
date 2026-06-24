-- Admin-only write access to avatars/ in the email-assets bucket
CREATE POLICY "Admins can upload avatar files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1] = 'avatars'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update avatar files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1] = 'avatars'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete avatar files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1] = 'avatars'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);