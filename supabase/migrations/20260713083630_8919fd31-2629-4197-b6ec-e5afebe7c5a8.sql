
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
