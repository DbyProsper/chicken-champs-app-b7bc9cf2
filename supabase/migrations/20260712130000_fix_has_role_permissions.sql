-- Fix driver-related policies to use private.has_role instead of public.has_role
DROP POLICY IF EXISTS "Drivers read available or own" ON public.deliveries;
CREATE POLICY "Drivers read available or own" ON public.deliveries FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'driver'::public.app_role) AND (
      driver_id IS NULL OR
      EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Drivers update own delivery" ON public.deliveries;
CREATE POLICY "Drivers update own delivery" ON public.deliveries FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'driver'::public.app_role) AND (
      driver_id IS NULL OR
      EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
    )
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'driver'::public.app_role) AND
    EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
  );

-- Fix driver policies on drivers table that use has_role
DROP POLICY IF EXISTS "Driver creates own profile" ON public.drivers;
CREATE POLICY "Driver creates own profile" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'driver'::public.app_role)
    AND public.drivers.user_id = auth.uid()
  );

-- Fix order access policies for drivers
DROP POLICY IF EXISTS "Drivers read assigned order" ON public.orders;
CREATE POLICY "Drivers read assigned order" ON public.orders FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'driver'::public.app_role) AND
    EXISTS (
      SELECT 1 FROM public.deliveries dl
      JOIN public.drivers d ON d.id = dl.driver_id
      WHERE dl.order_id = orders.id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers read assigned order items" ON public.order_items;
CREATE POLICY "Drivers read assigned order items" ON public.order_items FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'driver'::public.app_role) AND
    EXISTS (
      SELECT 1 FROM public.deliveries dl
      JOIN public.drivers d ON d.id = dl.driver_id
      WHERE dl.order_id = order_items.order_id AND d.user_id = auth.uid()
    )
  );
