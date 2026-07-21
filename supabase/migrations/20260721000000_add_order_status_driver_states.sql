-- V7: add driver lifecycle statuses to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'handed_to_driver';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'on_the_way';
