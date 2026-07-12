
DROP POLICY IF EXISTS "Read menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Staff write menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Staff update menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Read site-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff write site-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff update site-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete site-media" ON storage.objects;

CREATE POLICY "Read menu-images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'menu-images');
CREATE POLICY "Staff write menu-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update menu-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete menu-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));

CREATE POLICY "Read site-media" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site-media');
CREATE POLICY "Staff write site-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-media' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update site-media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-media' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete site-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-media' AND public.is_staff(auth.uid()));
