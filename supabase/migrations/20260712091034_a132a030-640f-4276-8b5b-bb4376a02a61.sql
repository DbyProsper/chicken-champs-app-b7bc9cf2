
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
