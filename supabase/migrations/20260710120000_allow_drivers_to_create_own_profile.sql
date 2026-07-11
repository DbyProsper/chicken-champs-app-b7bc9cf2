CREATE POLICY "Driver creates own profile" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'driver'::public.app_role)
    AND public.drivers.user_id = auth.uid()
  );
