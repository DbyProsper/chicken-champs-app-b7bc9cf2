
CREATE OR REPLACE FUNCTION public.create_delivery_for_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.fulfillment = 'delivery' THEN
    INSERT INTO public.deliveries (order_id, distance_km, delivery_fee_cents, status)
    VALUES (NEW.id, NEW.distance_km, COALESCE(NEW.delivery_fee_cents, 0), 'pending')
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_delivery_for_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_create_delivery ON public.orders;
CREATE TRIGGER trg_orders_create_delivery
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_delivery_for_order();
