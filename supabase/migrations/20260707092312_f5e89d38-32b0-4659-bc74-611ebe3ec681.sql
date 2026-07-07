
-- ============================================================
-- Champs Chicken v2: branches, customer accounts, PIN verification,
-- promotions, order-user linking
-- ============================================================

-- 1. Branches
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  postal_code text NOT NULL,
  phone text,
  whatsapp text,
  latitude double precision,
  longitude double precision,
  opens_at time NOT NULL DEFAULT '08:00',
  closes_at time NOT NULL DEFAULT '21:00',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.branches TO anon, authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches readable" ON public.branches FOR SELECT USING (true);
CREATE POLICY "branches admin write" ON public.branches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.branches (slug, name, address, city, postal_code, latitude, longitude, sort_order) VALUES
  ('dikeni', 'Champs Dikeni', '166 Garden Street', 'Dikeni', '5700', -32.7859, 26.8460, 1),
  ('fort-beaufort', 'Champs Fort Beaufort', 'Campbell Street', 'Fort Beaufort', '5720', -32.7830, 26.6320, 2);

-- 2. Extend orders: branch, user link, PIN, verification
ALTER TABLE public.orders
  ADD COLUMN branch_id uuid REFERENCES public.branches(id),
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN pickup_pin text,
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN verified_by uuid REFERENCES auth.users(id);

-- Backfill existing orders → Dikeni
UPDATE public.orders SET branch_id = (SELECT id FROM public.branches WHERE slug='dikeni') WHERE branch_id IS NULL;
UPDATE public.orders SET pickup_pin = lpad((floor(random()*10000))::int::text, 4, '0') WHERE pickup_pin IS NULL;
ALTER TABLE public.orders ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN pickup_pin SET NOT NULL;

-- Trigger: auto-generate PIN on insert if not provided
CREATE OR REPLACE FUNCTION public.set_order_pickup_pin()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.pickup_pin IS NULL OR NEW.pickup_pin = '' THEN
    NEW.pickup_pin := lpad((floor(random()*10000))::int::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER orders_set_pin BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_pickup_pin();

-- Replace anon insert policy to permit new columns (branch_id required, user_id optional, PIN nullable so trigger fills)
DROP POLICY IF EXISTS "orders anyone create" ON public.orders;
CREATE POLICY "orders anyone create" ON public.orders FOR INSERT TO public
WITH CHECK (
  length(customer_name) BETWEEN 1 AND 100
  AND length(customer_phone) BETWEEN 5 AND 20
  AND status = 'pending'
  AND subtotal_cents >= 0
  AND branch_id IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
  AND verified_at IS NULL
  AND verified_by IS NULL
);

-- 3. Profiles for customer accounts
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  favorite_branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles staff read" ON public.profiles FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Promotions / weekly specials
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id), -- NULL = all branches
  title text NOT NULL,
  description text,
  badge text,                                    -- e.g. "WED SPECIAL"
  price_cents int,
  image_url text,
  day_of_week int,                               -- 0-6 (Sun-Sat), NULL = any day
  active_from timestamptz,
  active_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promos readable" ON public.promotions FOR SELECT USING (true);
CREATE POLICY "promos staff write" ON public.promotions FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Allow authenticated users to read their own orders (in addition to existing public read via order number)
-- (orders public read already exists, this is fine)

-- 6. Extend user_roles with optional branch scope (NULL = all branches)
ALTER TABLE public.user_roles ADD COLUMN branch_id uuid REFERENCES public.branches(id);
