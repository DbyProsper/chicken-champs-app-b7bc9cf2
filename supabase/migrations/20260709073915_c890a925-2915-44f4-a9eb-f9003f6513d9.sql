DROP POLICY IF EXISTS "media assets public read" ON public.media_assets;
CREATE POLICY "media assets active public read" ON public.media_assets
  FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "media assets staff read all" ON public.media_assets
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));