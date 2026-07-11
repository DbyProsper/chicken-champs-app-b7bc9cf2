
-- Add image_url to menu items for per-item admin-editable images
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url text;

-- Storage policies: menu-images and site-media buckets
-- Public read access
DROP POLICY IF EXISTS "Public can read menu images" ON storage.objects;
CREATE POLICY "Public can read menu images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('menu-images', 'site-media'));

-- Staff/admin can upload
DROP POLICY IF EXISTS "Staff can upload menu images" ON storage.objects;
CREATE POLICY "Staff can upload menu images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('menu-images', 'site-media')
    AND public.is_staff(auth.uid())
  );

-- Staff/admin can update
DROP POLICY IF EXISTS "Staff can update menu images" ON storage.objects;
CREATE POLICY "Staff can update menu images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('menu-images', 'site-media')
    AND public.is_staff(auth.uid())
  );

-- Staff/admin can delete
DROP POLICY IF EXISTS "Staff can delete menu images" ON storage.objects;
CREATE POLICY "Staff can delete menu images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('menu-images', 'site-media')
    AND public.is_staff(auth.uid())
  );
