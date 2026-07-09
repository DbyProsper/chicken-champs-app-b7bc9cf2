DROP POLICY IF EXISTS "branches admin write" ON public.branches;
CREATE POLICY "branches admin write" ON public.branches
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "order_items staff modify" ON public.order_items;
CREATE POLICY "order_items staff modify" ON public.order_items
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "promos staff write" ON public.promotions;
CREATE POLICY "promos staff write" ON public.promotions
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));