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