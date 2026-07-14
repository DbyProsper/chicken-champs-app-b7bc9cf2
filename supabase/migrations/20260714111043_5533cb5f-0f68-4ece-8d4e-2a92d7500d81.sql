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