-- Combined migrations for Champs Chicken project
-- Apply this in the Supabase SQL editor or via psql against your project''s database.


-- BEGIN 20260703211112_c34b6ac0-425b-481e-a52e-fd6544b51ee9.sql


-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');
CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'out_for_delivery', 'completed', 'cancelled');
CREATE TYPE public.fulfillment_type AS ENUM ('pickup', 'delivery');

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Menu items
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant_label TEXT,
  description TEXT,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER menu_items_updated BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Orders
CREATE SEQUENCE public.order_number_seq START 1001;
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('CH-' || nextval('public.order_number_seq')::text),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  fulfillment fulfillment_type NOT NULL,
  delivery_notes TEXT,
  subtotal_cents INT NOT NULL CHECK (subtotal_cents >= 0),
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.orders TO anon, authenticated;
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit_price_cents INT NOT NULL CHECK (unit_price_cents >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO anon, authenticated;
GRANT UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'));
$$;

-- Policies: categories
CREATE POLICY "categories readable" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories staff write" ON public.categories FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Policies: menu_items
CREATE POLICY "menu readable" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "menu staff write" ON public.menu_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Policies: orders
CREATE POLICY "orders anyone create" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders public read" ON public.orders FOR SELECT USING (true);
CREATE POLICY "orders staff update" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "orders staff delete" ON public.orders FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Policies: order_items
CREATE POLICY "order_items create" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items read" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "order_items staff modify" ON public.order_items FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Roles policies
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- END 20260703211112_c34b6ac0-425b-481e-a52e-fd6544b51ee9.sql


-- BEGIN 20260703211126_b70cf184-efca-4f23-bb06-f44ce6d7d148.sql


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

-- END 20260703211126_b70cf184-efca-4f23-bb06-f44ce6d7d148.sql


-- BEGIN 20260707092312_f5e89d38-32b0-4659-bc74-611ebe3ec681.sql


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

-- END 20260707092312_f5e89d38-32b0-4659-bc74-611ebe3ec681.sql


-- BEGIN 20260707092335_fc02b776-0f60-4cad-986b-8c6d575f027c.sql


REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_pickup_pin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
-- RLS policies still call has_role/is_staff correctly because policies evaluate as the table owner.

-- END 20260707092335_fc02b776-0f60-4cad-986b-8c6d575f027c.sql


-- BEGIN 20260708120000_fix_admin_role_access.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');
  END IF;
END
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role in ('admin', 'staff')
  );
$$;

alter table public.user_roles enable row level security;

drop policy if exists "read own roles" on public.user_roles;
drop policy if exists "admin manage roles" on public.user_roles;

create policy "read own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "admin manage roles"
  on public.user_roles
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant usage on type public.app_role to authenticated;

-- END 20260708120000_fix_admin_role_access.sql


-- BEGIN 20260709073124_87dfe2ed-bcec-43d5-9d08-2e1c796df716.sql

CREATE OR REPLACE FUNCTION public.is_champs_owner_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN ('admin1@champs.co.za', 'admin2@champs.co.za');
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  ) OR (
    _role = 'admin'::app_role
    AND _user_id = auth.uid()
    AND public.is_champs_owner_email()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','staff')
  ) OR (
    _user_id = auth.uid()
    AND public.is_champs_owner_email()
  );
$$;

CREATE TABLE public.site_settings (
  id text PRIMARY KEY DEFAULT 'main',
  hero_eyebrow text NOT NULL DEFAULT 'Now taking online orders',
  hero_line_one text NOT NULL DEFAULT 'Crispy. Bold.',
  hero_line_two text NOT NULL DEFAULT 'Champs Chicken.',
  hero_body text NOT NULL DEFAULT 'Freshly fried chicken, loaded chips and legendary combos. Order for pickup or delivery in your town.',
  hero_image_key text NOT NULL DEFAULT 'girls-lunch',
  hero_focus_x integer NOT NULL DEFAULT 50 CHECK (hero_focus_x BETWEEN 0 AND 100),
  hero_focus_y integer NOT NULL DEFAULT 30 CHECK (hero_focus_y BETWEEN 0 AND 100),
  primary_cta_label text NOT NULL DEFAULT 'Order now',
  secondary_cta_label text NOT NULL DEFAULT 'Track order',
  theme text NOT NULL DEFAULT 'classic-red',
  show_promotions boolean NOT NULL DEFAULT true,
  show_categories boolean NOT NULL DEFAULT true,
  show_brand_strip boolean NOT NULL DEFAULT true,
  show_branch_info boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = 'main')
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site settings public read" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "site settings staff write" ON public.site_settings
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER set_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_settings (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_key text NOT NULL UNIQUE,
  src text NOT NULL,
  alt text NOT NULL DEFAULT '',
  usage text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.media_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media assets public read" ON public.media_assets
  FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "media assets staff write" ON public.media_assets
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER set_media_assets_updated_at
BEFORE UPDATE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.media_assets (title, image_key, src, alt, usage, sort_order) VALUES
  ('Girls lunch hero', 'girls-lunch', '/images/champs/girls-lunch.jpg', 'Customers enjoying Champs Chicken together', 'hero', 10),
  ('Chicken hero', 'chicken-hero', '/images/champs/chicken-hero.jpg', 'Fresh Champs fried chicken', 'homepage-card', 20),
  ('Chicken and chips', 'chicken-chips', '/images/champs/chicken-chips.jpg', 'Champs chicken served with chips', 'homepage-card', 30),
  ('Champs chef', 'chef', '/images/champs/chef.jpg', 'Champs kitchen team member', 'brand', 40),
  ('Customers eating together', 'couple', '/images/champs/couple.jpg', 'Customers enjoying a meal at Champs', 'brand', 50),
  ('Champs logo', 'champs-logo', '/images/champs/champs-logo.jpeg', 'Champs Chicken logo', 'logo', 60)
ON CONFLICT (image_key) DO UPDATE SET
  title = EXCLUDED.title,
  src = EXCLUDED.src,
  alt = EXCLUDED.alt,
  usage = EXCLUDED.usage,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE lower(email) IN ('admin1@champs.co.za', 'admin2@champs.co.za')
ON CONFLICT (user_id, role) DO NOTHING;

-- END 20260709073124_87dfe2ed-bcec-43d5-9d08-2e1c796df716.sql


-- BEGIN 20260709073157_23d65220-8b52-4751-82ea-c56900ce787e.sql

REVOKE EXECUTE ON FUNCTION public.is_champs_owner_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;

-- END 20260709073157_23d65220-8b52-4751-82ea-c56900ce787e.sql


-- BEGIN 20260709073323_31521cbe-a85b-4678-b214-3915af29180b.sql


-- END 20260709073323_31521cbe-a85b-4678-b214-3915af29180b.sql


-- BEGIN 20260709073418_506863d0-58cf-48c9-8f22-b0c06776f913.sql

CREATE OR REPLACE FUNCTION public.get_my_access_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(auth.jwt() ->> 'email', '')) IN ('admin1@champs.co.za', 'admin2@champs.co.za') THEN 'admin'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role) THEN 'admin'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'staff'::public.app_role) THEN 'staff'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'user'::public.app_role) THEN 'user'::public.app_role
    ELSE NULL::public.app_role
  END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_access_role() TO authenticated;

-- END 20260709073418_506863d0-58cf-48c9-8f22-b0c06776f913.sql


-- BEGIN 20260709073810_881e6e4a-67e6-4351-95ac-ebc3a6b57b1e.sql

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

-- END 20260709073810_881e6e4a-67e6-4351-95ac-ebc3a6b57b1e.sql


-- BEGIN 20260709073915_c890a925-2915-44f4-a9eb-f9003f6513d9.sql

DROP POLICY IF EXISTS "media assets public read" ON public.media_assets;
CREATE POLICY "media assets active public read" ON public.media_assets
  FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "media assets staff read all" ON public.media_assets
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

-- END 20260709073915_c890a925-2915-44f4-a9eb-f9003f6513d9.sql


-- BEGIN 20260710091722_31d607f9-0de1-4b33-be49-04cbafe21206.sql

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';

-- END 20260710091722_31d607f9-0de1-4b33-be49-04cbafe21206.sql


-- BEGIN 20260710091753_43f6e32f-38c2-4292-8a41-58ccfc0ff04f.sql


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

-- END 20260710091753_43f6e32f-38c2-4292-8a41-58ccfc0ff04f.sql


-- BEGIN 20260710091804_be3f0d49-38b1-44d2-ba7b-c4844a3a33b5.sql

REVOKE EXECUTE ON FUNCTION public.is_driver(uuid) FROM PUBLIC, anon, authenticated;

-- END 20260710091804_be3f0d49-38b1-44d2-ba7b-c4844a3a33b5.sql


-- BEGIN 20260710091839_95ab1f1f-d46c-440b-be9d-7c84ed823fa0.sql


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

-- END 20260710091839_95ab1f1f-d46c-440b-be9d-7c84ed823fa0.sql


-- BEGIN 20260710120000_allow_drivers_to_create_own_profile.sql

CREATE POLICY "Driver creates own profile" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'driver'::public.app_role)
    AND public.drivers.user_id = auth.uid()
  );

-- END 20260710120000_allow_drivers_to_create_own_profile.sql


-- BEGIN 20260710140000_add_admin_role_grant_rpc.sql

CREATE OR REPLACE FUNCTION public.grant_access_role(_email text, _role public.app_role)
RETURNS TABLE (user_id uuid, email text, role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  target_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can grant access' USING ERRCODE = '42501';
  END IF;

  SELECT au.id, lower(au.email)
    INTO target_user_id, target_email
  FROM auth.users au
  WHERE lower(au.email) = lower(_email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No account exists for that email yet. Ask them to sign up first, then grant access.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY
  SELECT target_user_id, target_email, _role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_access_role(text, public.app_role) TO authenticated;

-- END 20260710140000_add_admin_role_grant_rpc.sql


-- BEGIN 20260711091014_20659f6e-4f51-434a-9e4f-d03a7234ea11.sql

-- Allow a signed-in user with the driver role to create their own driver profile row.
DROP POLICY IF EXISTS "Driver creates own profile" ON public.drivers;
CREATE POLICY "Driver creates own profile" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'driver'::public.app_role)
    AND public.drivers.user_id = auth.uid()
  );

-- Admin-only RPC to grant any app_role to a user by email. Uses SECURITY DEFINER
-- so it can look up auth.users without exposing the service role key.
CREATE OR REPLACE FUNCTION public.grant_access_role(_email text, _role public.app_role)
RETURNS TABLE (user_id uuid, email text, role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  target_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can grant access' USING ERRCODE = '42501';
  END IF;

  SELECT au.id, lower(au.email)
    INTO target_user_id, target_email
  FROM auth.users au
  WHERE lower(au.email) = lower(_email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No account exists for that email yet. Ask them to sign up first, then grant access.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY
  SELECT target_user_id, target_email, _role;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_access_role(text, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_access_role(text, public.app_role) TO authenticated;

-- END 20260711091014_20659f6e-4f51-434a-9e4f-d03a7234ea11.sql


-- BEGIN 20260711092020_4394a194-b4e1-46cf-877b-344469a41b6e.sql


-- Add image_url to menu items for per-item admin-editable images
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url text;

-- Storage policies: menu-images and site-media buckets
-- Public read access
DROP POLICY IF EXISTS "Public can read menu images" ON storage.objects;
CREATE POLICY "Public can read menu images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('menu-images', 'site-media'));

-- Staff/admin can upload
DROP POLICY IF EXISTS "Staff can upload menu images" ON storage.objects;
CREATE POLICY "Staff can upload menu images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('menu-images', 'site-media')
    AND public.is_staff(auth.uid())
  );

-- Staff/admin can update
DROP POLICY IF EXISTS "Staff can update menu images" ON storage.objects;
CREATE POLICY "Staff can update menu images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('menu-images', 'site-media')
    AND public.is_staff(auth.uid())
  );

-- Staff/admin can delete
DROP POLICY IF EXISTS "Staff can delete menu images" ON storage.objects;
CREATE POLICY "Staff can delete menu images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('menu-images', 'site-media')
    AND public.is_staff(auth.uid())
  );

-- END 20260711092020_4394a194-b4e1-46cf-877b-344469a41b6e.sql


-- BEGIN 20260711093000_add_driver_profile_rpc.sql

CREATE OR REPLACE FUNCTION public.get_driver_profile_for_user(_user_id uuid)
RETURNS TABLE (id uuid, name text, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.status
  FROM public.drivers d
  WHERE d.user_id = _user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_profile_for_user(uuid) TO authenticated;

-- END 20260711093000_add_driver_profile_rpc.sql


-- BEGIN 20260712091034_a132a030-640f-4276-8b5b-bb4376a02a61.sql


-- 1) Fix ambiguous user_id in grant_access_role
DROP FUNCTION IF EXISTS public.grant_access_role(text, public.app_role);
CREATE OR REPLACE FUNCTION public.grant_access_role(_email text, _role public.app_role)
RETURNS TABLE (out_user_id uuid, out_email text, out_role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  target_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can grant access' USING ERRCODE = '42501';
  END IF;

  SELECT au.id, lower(au.email)
    INTO target_user_id, target_email
  FROM auth.users au
  WHERE lower(au.email) = lower(_email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No account exists for that email yet. Ask them to sign up first, then grant access.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY SELECT target_user_id, target_email, _role;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_access_role(text, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_access_role(text, public.app_role) TO authenticated;

-- 2) Delivery V4: batching + ETA
CREATE TABLE IF NOT EXISTS public.delivery_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_batches TO authenticated;
GRANT ALL ON public.delivery_batches TO service_role;
ALTER TABLE public.delivery_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage batches" ON public.delivery_batches;
DROP POLICY IF EXISTS "Driver read own batch" ON public.delivery_batches;
DROP POLICY IF EXISTS "Driver update own batch" ON public.delivery_batches;
CREATE POLICY "Staff manage batches" ON public.delivery_batches FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Driver read own batch" ON public.delivery_batches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Driver update own batch" ON public.delivery_batches FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
DROP TRIGGER IF EXISTS trg_delivery_batches_updated ON public.delivery_batches;
CREATE TRIGGER trg_delivery_batches_updated BEFORE UPDATE ON public.delivery_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.delivery_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS queue_position integer,
  ADD COLUMN IF NOT EXISTS estimated_eta_min integer,
  ADD COLUMN IF NOT EXISTS estimated_eta_max integer,
  ADD COLUMN IF NOT EXISTS actual_delivery_time timestamptz;

ALTER TABLE public.delivery_settings
  ADD COLUMN IF NOT EXISTS base_prep_min integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS avg_stop_min integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS peak_threshold integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS max_wait_min integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS normal_capacity_min integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS normal_capacity_max integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS peak_capacity_min integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS peak_capacity_max integer NOT NULL DEFAULT 4;

-- END 20260712091034_a132a030-640f-4276-8b5b-bb4376a02a61.sql


-- BEGIN 20260712091113_cfbef293-a402-49ff-82f8-bfd4c57a01f9.sql


DROP POLICY IF EXISTS "Read menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Staff write menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Staff update menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Read site-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff write site-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff update site-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete site-media" ON storage.objects;

CREATE POLICY "Read menu-images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'menu-images');
CREATE POLICY "Staff write menu-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update menu-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete menu-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));

CREATE POLICY "Read site-media" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site-media');
CREATE POLICY "Staff write site-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-media' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update site-media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-media' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete site-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-media' AND public.is_staff(auth.uid()));

-- END 20260712091113_cfbef293-a402-49ff-82f8-bfd4c57a01f9.sql


-- BEGIN 20260713083630_8919fd31-2629-4197-b6ec-e5afebe7c5a8.sql


-- V6: add 'ready' status for pickup flow
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready';

-- Driver banking details
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text;

-- Delivery payment + assignment tracking
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_paid',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS proof_of_payment_url text,
  ADD COLUMN IF NOT EXISTS broadcast_at timestamptz,
  ADD COLUMN IF NOT EXISTS assign_deadline_at timestamptz;

-- Count of online drivers (drivers.status = 'active')
CREATE OR REPLACE FUNCTION public.online_drivers_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.drivers WHERE status = 'active';
$$;
GRANT EXECUTE ON FUNCTION public.online_drivers_count() TO anon, authenticated;

-- Auto-assign: pick lowest-load online driver for deliveries whose 20s window has passed
CREATE OR REPLACE FUNCTION public.auto_assign_pending_deliveries()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  chosen_driver uuid;
  next_pos int;
  assigned int := 0;
BEGIN
  FOR rec IN
    SELECT id, order_id
    FROM public.deliveries
    WHERE driver_id IS NULL
      AND status = 'pending'
      AND (assign_deadline_at IS NULL OR assign_deadline_at <= now())
    ORDER BY created_at ASC
  LOOP
    SELECT d.id INTO chosen_driver
    FROM public.drivers d
    WHERE d.status = 'active'
    ORDER BY (
      SELECT COUNT(*) FROM public.deliveries x
      WHERE x.driver_id = d.id AND x.status <> 'delivered'
    ) ASC, d.created_at ASC
    LIMIT 1;

    IF chosen_driver IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(MAX(queue_position),0) + 1 INTO next_pos
    FROM public.deliveries
    WHERE driver_id = chosen_driver AND status <> 'delivered';

    UPDATE public.deliveries
    SET driver_id = chosen_driver,
        status = 'accepted',
        queue_position = next_pos
    WHERE id = rec.id;

    assigned := assigned + 1;
  END LOOP;

  RETURN assigned;
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_assign_pending_deliveries() TO authenticated;

-- Ensure realtime publication has our tables
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- RLS for proof-of-payment uploads (private bucket 'payment-proofs')
-- Customer of the order can upload, order's assigned driver + staff/admin can read
DROP POLICY IF EXISTS "payment_proofs_customer_write" ON storage.objects;
CREATE POLICY "payment_proofs_customer_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs' AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payment_proofs_read" ON storage.objects;
CREATE POLICY "payment_proofs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs' AND (
      public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id::text = (storage.foldername(name))[1]
          AND o.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.deliveries d
        JOIN public.drivers dr ON dr.id = d.driver_id
        WHERE d.order_id::text = (storage.foldername(name))[1]
          AND dr.user_id = auth.uid()
      )
    )
  );

-- END 20260713083630_8919fd31-2629-4197-b6ec-e5afebe7c5a8.sql


-- BEGIN 20260714110921_623b76f4-4805-470f-9849-87152d91907a.sql

-- Driver self-request + reliable admin approval flow

CREATE TABLE IF NOT EXISTS public.driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.driver_applications TO authenticated;
GRANT ALL ON public.driver_applications TO service_role;

ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own driver application" ON public.driver_applications;
CREATE POLICY "Users manage own driver application"
ON public.driver_applications
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Admins manage driver applications" ON public.driver_applications;
CREATE POLICY "Admins manage driver applications"
ON public.driver_applications
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS set_driver_applications_updated_at ON public.driver_applications;
CREATE TRIGGER set_driver_applications_updated_at
BEFORE UPDATE ON public.driver_applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS driver_applications_status_created_idx
ON public.driver_applications (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_my_access_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN lower(coalesce(auth.jwt() ->> 'email', '')) IN ('admin1@champs.co.za', 'admin2@champs.co.za') THEN 'admin'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role) THEN 'admin'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'staff'::public.app_role) THEN 'staff'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'driver'::public.app_role) THEN 'driver'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'user'::public.app_role) THEN 'user'::public.app_role
    ELSE NULL::public.app_role
  END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_access_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  ) OR (
    _role = 'admin'::public.app_role
    AND _user_id = auth.uid()
    AND public.is_champs_owner_email()
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin'::public.app_role, 'staff'::public.app_role)
  ) OR (
    _user_id = auth.uid()
    AND public.is_champs_owner_email()
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_driver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'driver'::public.app_role
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_driver(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.grant_access_role(text, public.app_role);
CREATE FUNCTION public.grant_access_role(_email text, _role public.app_role)
RETURNS TABLE(out_user_id uuid, out_email text, out_role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  target_user_id uuid;
  target_email text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can grant access' USING ERRCODE = '42501';
  END IF;

  SELECT au.id, lower(au.email)
    INTO target_user_id, target_email
  FROM auth.users au
  WHERE lower(au.email) = lower(trim(_email))
  ORDER BY au.created_at DESC
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No account exists for that email yet. Ask them to sign up first, then grant access.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY SELECT target_user_id, target_email, _role;
END;
$$;
GRANT EXECUTE ON FUNCTION public.grant_access_role(text, public.app_role) TO authenticated;

DROP FUNCTION IF EXISTS public.get_driver_profile_for_user(uuid);
CREATE FUNCTION public.get_driver_profile_for_user(_user_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  status text,
  branch_id uuid,
  bank_name text,
  bank_account_number text,
  bank_account_holder text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.id, d.name, d.phone, d.status, d.branch_id, d.bank_name, d.bank_account_number, d.bank_account_holder
  FROM public.drivers d
  WHERE d.user_id = _user_id
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_driver_profile_for_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_driver_by_email(
  _email text,
  _name text,
  _phone text,
  _branch_id uuid DEFAULT NULL,
  _bank_name text DEFAULT NULL,
  _bank_account_number text DEFAULT NULL,
  _bank_account_holder text DEFAULT NULL
)
RETURNS TABLE(out_driver_id uuid, out_user_id uuid, out_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  target_user_id uuid;
  target_email text;
  saved_driver_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can add drivers' USING ERRCODE = '42501';
  END IF;

  SELECT au.id, lower(au.email)
    INTO target_user_id, target_email
  FROM auth.users au
  WHERE lower(au.email) = lower(trim(_email))
  ORDER BY au.created_at DESC
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No account exists for that email yet. Ask them to sign up first, then add them as a driver.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'driver'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.drivers (user_id, name, phone, branch_id, bank_name, bank_account_number, bank_account_holder)
  VALUES (
    target_user_id,
    trim(_name),
    trim(_phone),
    _branch_id,
    NULLIF(trim(coalesce(_bank_name, '')), ''),
    NULLIF(trim(coalesce(_bank_account_number, '')), ''),
    NULLIF(trim(coalesce(_bank_account_holder, '')), '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    branch_id = EXCLUDED.branch_id,
    bank_name = COALESCE(EXCLUDED.bank_name, public.drivers.bank_name),
    bank_account_number = COALESCE(EXCLUDED.bank_account_number, public.drivers.bank_account_number),
    bank_account_holder = COALESCE(EXCLUDED.bank_account_holder, public.drivers.bank_account_holder),
    updated_at = now()
  RETURNING public.drivers.id INTO saved_driver_id;

  UPDATE public.driver_applications da
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE da.user_id = target_user_id;

  RETURN QUERY SELECT saved_driver_id, target_user_id, target_email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_driver_by_email(text, text, text, uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_driver_application(
  _name text,
  _phone text,
  _branch_id uuid DEFAULT NULL,
  _bank_name text DEFAULT NULL,
  _bank_account_number text DEFAULT NULL,
  _bank_account_holder text DEFAULT NULL
)
RETURNS TABLE(out_application_id uuid, out_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  saved_application_id uuid;
  saved_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before requesting driver access' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Your account already has driver access.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.driver_applications (user_id, name, phone, branch_id, bank_name, bank_account_number, bank_account_holder, status)
  VALUES (
    auth.uid(),
    trim(_name),
    trim(_phone),
    _branch_id,
    NULLIF(trim(coalesce(_bank_name, '')), ''),
    NULLIF(trim(coalesce(_bank_account_number, '')), ''),
    NULLIF(trim(coalesce(_bank_account_holder, '')), ''),
    'pending'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    branch_id = EXCLUDED.branch_id,
    bank_name = EXCLUDED.bank_name,
    bank_account_number = EXCLUDED.bank_account_number,
    bank_account_holder = EXCLUDED.bank_account_holder,
    status = CASE WHEN public.driver_applications.status = 'approved' THEN 'approved' ELSE 'pending' END,
    admin_notes = NULL,
    updated_at = now()
  RETURNING public.driver_applications.id, public.driver_applications.status
  INTO saved_application_id, saved_status;

  RETURN QUERY SELECT saved_application_id, saved_status;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_driver_application(text, text, uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_driver_application(_application_id uuid)
RETURNS TABLE(out_driver_id uuid, out_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  app_row public.driver_applications%ROWTYPE;
  saved_driver_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can approve driver applications' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO app_row
  FROM public.driver_applications da
  WHERE da.id = _application_id
  LIMIT 1;

  IF app_row.id IS NULL THEN
    RAISE EXCEPTION 'Driver application not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (app_row.user_id, 'driver'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.drivers (user_id, name, phone, branch_id, bank_name, bank_account_number, bank_account_holder)
  VALUES (app_row.user_id, app_row.name, app_row.phone, app_row.branch_id, app_row.bank_name, app_row.bank_account_number, app_row.bank_account_holder)
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    branch_id = EXCLUDED.branch_id,
    bank_name = COALESCE(EXCLUDED.bank_name, public.drivers.bank_name),
    bank_account_number = COALESCE(EXCLUDED.bank_account_number, public.drivers.bank_account_number),
    bank_account_holder = COALESCE(EXCLUDED.bank_account_holder, public.drivers.bank_account_holder),
    updated_at = now()
  RETURNING public.drivers.id INTO saved_driver_id;

  UPDATE public.driver_applications da
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = NULL, updated_at = now()
  WHERE da.id = _application_id;

  RETURN QUERY SELECT saved_driver_id, app_row.user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_driver_application(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_driver_application(_application_id uuid, _admin_notes text DEFAULT NULL)
RETURNS TABLE(out_application_id uuid, out_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can reject driver applications' USING ERRCODE = '42501';
  END IF;

  UPDATE public.driver_applications da
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = NULLIF(trim(coalesce(_admin_notes, '')), ''), updated_at = now()
  WHERE da.id = _application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver application not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT _application_id, 'rejected'::text;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_driver_application(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Driver creates own profile" ON public.drivers;
CREATE POLICY "Driver creates own profile"
ON public.drivers
FOR INSERT
TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'driver'::public.app_role) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Driver reads own row" ON public.drivers;
CREATE POLICY "Driver reads own row"
ON public.drivers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Driver updates own status" ON public.drivers;
CREATE POLICY "Driver updates own status"
ON public.drivers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff manage drivers" ON public.drivers;
CREATE POLICY "Staff manage drivers"
ON public.drivers
FOR ALL
TO authenticated
USING (private.is_staff(auth.uid()))
WITH CHECK (private.is_staff(auth.uid()));

-- END 20260714110921_623b76f4-4805-470f-9849-87152d91907a.sql


-- BEGIN 20260714111043_5533cb5f-0f68-4ece-8d4e-2a92d7500d81.sql

-- Safe scoped helpers for manual driver payment flow

CREATE OR REPLACE FUNCTION public.submit_delivery_payment(
  _delivery_id uuid,
  _payment_reference text,
  _proof_path text DEFAULT NULL
)
RETURNS TABLE(out_delivery_id uuid, out_payment_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_order_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before submitting payment proof' USING ERRCODE = '42501';
  END IF;

  SELECT o.user_id INTO target_order_user_id
  FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id
  WHERE d.id = _delivery_id
  LIMIT 1;

  IF target_order_user_id IS NULL OR target_order_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only submit payment for your own delivery order' USING ERRCODE = '42501';
  END IF;

  UPDATE public.deliveries d
  SET payment_status = 'pending',
      payment_reference = trim(_payment_reference),
      proof_of_payment_url = COALESCE(NULLIF(trim(coalesce(_proof_path, '')), ''), d.proof_of_payment_url),
      updated_at = now()
  WHERE d.id = _delivery_id;

  RETURN QUERY SELECT _delivery_id, 'pending'::text;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_delivery_payment(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_delivery_payment(_delivery_id uuid)
RETURNS TABLE(out_delivery_id uuid, out_payment_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before confirming payment' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    private.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id = _delivery_id
        AND dr.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Only the assigned driver or staff can confirm this payment' USING ERRCODE = '42501';
  END IF;

  UPDATE public.deliveries d
  SET payment_status = 'paid',
      updated_at = now()
  WHERE d.id = _delivery_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT _delivery_id, 'paid'::text;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_payment(uuid) TO authenticated;

DROP POLICY IF EXISTS "payment_proofs_customer_write" ON storage.objects;
CREATE POLICY "payment_proofs_customer_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(objects.name))[1]
      AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "payment_proofs_update_own" ON storage.objects;
CREATE POLICY "payment_proofs_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(objects.name))[1]
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(objects.name))[1]
      AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "payment_proofs_read" ON storage.objects;
CREATE POLICY "payment_proofs_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (
    private.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id::text = (storage.foldername(objects.name))[1]
        AND o.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.order_id::text = (storage.foldername(objects.name))[1]
        AND dr.user_id = auth.uid()
    )
  )
);

-- END 20260714111043_5533cb5f-0f68-4ece-8d4e-2a92d7500d81.sql

