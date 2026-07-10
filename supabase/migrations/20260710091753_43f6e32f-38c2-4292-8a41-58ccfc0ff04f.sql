
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision,
  ADD COLUMN IF NOT EXISTS delivery_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance_km numeric(6,2),
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS driver_id uuid;

CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage drivers" ON public.drivers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Driver reads own row" ON public.drivers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Driver updates own status" ON public.drivers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read locations" ON public.driver_locations FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Driver writes own location" ON public.driver_locations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  distance_km numeric(6,2),
  delivery_fee_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage deliveries" ON public.deliveries FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Drivers read available or own" ON public.deliveries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::public.app_role) AND (
      driver_id IS NULL OR
      EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
    )
  );
CREATE POLICY "Drivers update own delivery" ON public.deliveries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::public.app_role) AND (
      driver_id IS NULL OR
      EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'driver'::public.app_role) AND
    EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
  );
CREATE TRIGGER trg_deliveries_updated BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Drivers read assigned order" ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::public.app_role) AND
    EXISTS (
      SELECT 1 FROM public.deliveries dl
      JOIN public.drivers d ON d.id = dl.driver_id
      WHERE dl.order_id = orders.id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "Drivers read assigned order items" ON public.order_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::public.app_role) AND
    EXISTS (
      SELECT 1 FROM public.deliveries dl
      JOIN public.drivers d ON d.id = dl.driver_id
      WHERE dl.order_id = order_items.order_id AND d.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id text PRIMARY KEY DEFAULT 'default',
  max_radius_km numeric(4,1) NOT NULL DEFAULT 6.0,
  tier1_max_km numeric(4,1) NOT NULL DEFAULT 2.0,
  tier1_fee_cents integer NOT NULL DEFAULT 2500,
  tier2_max_km numeric(4,1) NOT NULL DEFAULT 4.0,
  tier2_fee_cents integer NOT NULL DEFAULT 4000,
  tier3_max_km numeric(4,1) NOT NULL DEFAULT 6.0,
  tier3_fee_cents integer NOT NULL DEFAULT 5500,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_settings TO authenticated;
GRANT ALL ON public.delivery_settings TO service_role;
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read delivery settings" ON public.delivery_settings FOR SELECT USING (true);
CREATE POLICY "Staff manage delivery settings" ON public.delivery_settings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_delivery_settings_updated BEFORE UPDATE ON public.delivery_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.delivery_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_driver(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'driver'::public.app_role);
$$;
