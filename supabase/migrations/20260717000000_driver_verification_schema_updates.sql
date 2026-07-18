-- Expand driver verification data and approval state tracking

ALTER TABLE public.driver_applications
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS student_number text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS active_order_limit integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS active_order_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_online_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_assignment_at timestamptz;

UPDATE public.drivers d
SET approval_status = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.driver_applications da
    WHERE da.user_id = d.user_id AND da.status = 'rejected'
  ) THEN 'rejected'
  WHEN EXISTS (
    SELECT 1
    FROM public.driver_applications da
    WHERE da.user_id = d.user_id AND da.status = 'pending'
  ) THEN 'pending'
  ELSE 'approved'
END
WHERE d.approval_status IS NULL OR d.approval_status = '';

CREATE OR REPLACE FUNCTION public.request_driver_application(
  _name text,
  _phone text,
  _id_number text DEFAULT NULL,
  _student_number text DEFAULT NULL,
  _profile_photo_url text DEFAULT NULL,
  _selfie_url text DEFAULT NULL,
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

  INSERT INTO public.driver_applications (
    user_id,
    name,
    phone,
    id_number,
    student_number,
    profile_photo_url,
    selfie_url,
    branch_id,
    bank_name,
    bank_account_number,
    bank_account_holder,
    status
  )
  VALUES (
    auth.uid(),
    trim(_name),
    trim(_phone),
    NULLIF(trim(coalesce(_id_number, '')), ''),
    NULLIF(trim(coalesce(_student_number, '')), ''),
    NULLIF(trim(coalesce(_profile_photo_url, '')), ''),
    NULLIF(trim(coalesce(_selfie_url, '')), ''),
    _branch_id,
    NULLIF(trim(coalesce(_bank_name, '')), ''),
    NULLIF(trim(coalesce(_bank_account_number, '')), ''),
    NULLIF(trim(coalesce(_bank_account_holder, '')), ''),
    'pending'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    id_number = EXCLUDED.id_number,
    student_number = EXCLUDED.student_number,
    profile_photo_url = EXCLUDED.profile_photo_url,
    selfie_url = EXCLUDED.selfie_url,
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

GRANT EXECUTE ON FUNCTION public.request_driver_application(text, text, text, text, text, text, uuid, text, text, text) TO authenticated;

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

  INSERT INTO public.drivers (
    user_id,
    name,
    phone,
    branch_id,
    bank_name,
    bank_account_number,
    bank_account_holder,
    approval_status,
    approved_at
  )
  VALUES (
    target_user_id,
    trim(_name),
    trim(_phone),
    _branch_id,
    NULLIF(trim(coalesce(_bank_name, '')), ''),
    NULLIF(trim(coalesce(_bank_account_number, '')), ''),
    NULLIF(trim(coalesce(_bank_account_holder, '')), ''),
    'approved',
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    branch_id = EXCLUDED.branch_id,
    bank_name = COALESCE(EXCLUDED.bank_name, public.drivers.bank_name),
    bank_account_number = COALESCE(EXCLUDED.bank_account_number, public.drivers.bank_account_number),
    bank_account_holder = COALESCE(EXCLUDED.bank_account_holder, public.drivers.bank_account_holder),
    approval_status = COALESCE(public.drivers.approval_status, 'approved'),
    approved_at = COALESCE(public.drivers.approved_at, now()),
    rejected_at = NULL,
    suspended_at = NULL,
    suspension_reason = NULL,
    updated_at = now()
  RETURNING public.drivers.id INTO saved_driver_id;

  UPDATE public.driver_applications da
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE da.user_id = target_user_id;

  RETURN QUERY SELECT saved_driver_id, target_user_id, target_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_driver_by_email(text, text, text, uuid, text, text, text) TO authenticated;

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

  INSERT INTO public.drivers (
    user_id,
    name,
    phone,
    branch_id,
    bank_name,
    bank_account_number,
    bank_account_holder,
    approval_status,
    approved_at
  )
  VALUES (
    app_row.user_id,
    app_row.name,
    app_row.phone,
    app_row.branch_id,
    app_row.bank_name,
    app_row.bank_account_number,
    app_row.bank_account_holder,
    'approved',
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    branch_id = EXCLUDED.branch_id,
    bank_name = COALESCE(EXCLUDED.bank_name, public.drivers.bank_name),
    bank_account_number = COALESCE(EXCLUDED.bank_account_number, public.drivers.bank_account_number),
    bank_account_holder = COALESCE(EXCLUDED.bank_account_holder, public.drivers.bank_account_holder),
    approval_status = 'approved',
    approved_at = COALESCE(public.drivers.approved_at, now()),
    rejected_at = NULL,
    suspended_at = NULL,
    suspension_reason = NULL,
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

  UPDATE public.drivers d
  SET approval_status = 'rejected', rejected_at = now(), approved_at = NULL, suspended_at = NULL, suspension_reason = NULL
  FROM public.driver_applications da
  WHERE da.id = _application_id
    AND da.user_id = d.user_id;

  RETURN QUERY SELECT _application_id, 'rejected'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_driver_application(uuid, text) TO authenticated;
