
-- Tighten INSERT policies with validation
DROP POLICY "orders anyone create" ON public.orders;
CREATE POLICY "orders anyone create" ON public.orders FOR INSERT
  WITH CHECK (
    length(customer_name) BETWEEN 1 AND 100
    AND length(customer_phone) BETWEEN 5 AND 20
    AND status = 'pending'
    AND subtotal_cents >= 0
  );

DROP POLICY "order_items create" ON public.order_items;
CREATE POLICY "order_items create" ON public.order_items FOR INSERT
  WITH CHECK (
    quantity BETWEEN 1 AND 99
    AND unit_price_cents >= 0
    AND length(item_name) BETWEEN 1 AND 200
  );

-- Restrict SECURITY DEFINER helpers to authenticated (policies still work via definer rights)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated;
