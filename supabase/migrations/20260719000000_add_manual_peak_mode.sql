ALTER TABLE public.delivery_settings
  ADD COLUMN IF NOT EXISTS manual_peak_mode boolean NOT NULL DEFAULT false;

-- Allow staff to update this setting
GRANT SELECT, UPDATE ON public.delivery_settings TO authenticated;
GRANT ALL ON public.delivery_settings TO service_role;

-- Ensure RLS allows staff to manage
DROP POLICY IF EXISTS "Staff manage delivery settings" ON public.delivery_settings;
CREATE POLICY "Staff manage delivery settings" ON public.delivery_settings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
