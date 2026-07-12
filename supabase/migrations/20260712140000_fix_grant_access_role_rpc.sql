-- Fix grant_access_role RPC to use private.has_role
CREATE OR REPLACE FUNCTION public.grant_access_role(_email text, _role public.app_role)
RETURNS TABLE (user_id uuid, email text, role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
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
