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