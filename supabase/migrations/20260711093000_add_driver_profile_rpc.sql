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