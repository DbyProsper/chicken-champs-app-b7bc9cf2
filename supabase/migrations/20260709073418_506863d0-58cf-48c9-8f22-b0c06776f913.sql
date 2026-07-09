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