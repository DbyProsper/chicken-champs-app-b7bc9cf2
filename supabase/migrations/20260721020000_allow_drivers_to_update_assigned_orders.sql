-- Allow drivers to update orders that are assigned to their own driver profile
DROP POLICY IF EXISTS "Drivers update assigned order" ON public.orders;

CREATE POLICY "Drivers update assigned order"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = orders.driver_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = orders.driver_id
        AND d.user_id = auth.uid()
    )
  );
