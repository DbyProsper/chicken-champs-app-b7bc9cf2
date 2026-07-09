CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_champs_owner_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN ('admin1@champs.co.za', 'admin2@champs.co.za');
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  ) OR (
    _role = 'admin'::public.app_role
    AND _user_id = auth.uid()
    AND private.is_champs_owner_email()
  );
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','staff')
  ) OR (
    _user_id = auth.uid()
    AND private.is_champs_owner_email()
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_champs_owner_email() TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated;

DROP POLICY IF EXISTS "categories staff write" ON public.categories;
CREATE POLICY "categories staff write" ON public.categories
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "menu staff write" ON public.menu_items;
CREATE POLICY "menu staff write" ON public.menu_items
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "orders staff update" ON public.orders;
CREATE POLICY "orders staff update" ON public.orders
  FOR UPDATE TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "orders staff delete" ON public.orders;
CREATE POLICY "orders staff delete" ON public.orders
  FOR DELETE TO authenticated
  USING (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "profiles staff read" ON public.profiles;
CREATE POLICY "profiles staff read" ON public.profiles
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;
CREATE POLICY "admin manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "site settings staff write" ON public.site_settings;
CREATE POLICY "site settings staff write" ON public.site_settings
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "media assets public read" ON public.media_assets;
CREATE POLICY "media assets public read" ON public.media_assets
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "media assets staff write" ON public.media_assets;
CREATE POLICY "media assets staff write" ON public.media_assets
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.is_champs_owner_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;