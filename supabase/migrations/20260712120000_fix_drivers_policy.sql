-- Fix drivers policy to use private.is_staff instead of public.is_staff
DROP POLICY IF EXISTS "Staff manage drivers" ON public.drivers;
CREATE POLICY "Staff manage drivers" ON public.drivers FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- Fix driver locations policy as well
DROP POLICY IF EXISTS "Staff read locations" ON public.driver_locations;
CREATE POLICY "Staff read locations" ON public.driver_locations FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

-- Fix deliveries policy to use private.is_staff instead of public.is_staff
DROP POLICY IF EXISTS "Staff manage deliveries" ON public.deliveries;
CREATE POLICY "Staff manage deliveries" ON public.deliveries FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
