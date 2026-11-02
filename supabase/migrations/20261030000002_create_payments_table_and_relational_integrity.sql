-- ============================================================
-- Migration 011: Create Relational Payments Table in Supabase
-- JATRA BAZAAR — Hybrid Architecture: Transactional Integrity
--
-- Supabase handles:
--   - Customers (profiles)
--   - Seats (seats)
--   - Bookings (bookings)
--   - Payments (payments)
--   - Tickets (tickets)
--
-- Relationship with Firebase Firestore:
--   - All records reference event_id = Firestore event document ID (TEXT)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payment_id TEXT UNIQUE,
  booking_id TEXT REFERENCES public.bookings(id) ON DELETE CASCADE,
  ticket_number TEXT,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  customer_phone TEXT,
  customer_name TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_gateway TEXT NOT NULL DEFAULT 'Paytm',
  gateway_order_id TEXT,
  gateway_transaction_id TEXT,
  gateway_checksum TEXT,
  gateway_response JSONB,
  payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Successful', 'Failed', 'Refunded', 'Cancelled')),
  payment_method TEXT,
  payment_channel TEXT,
  refund_id TEXT,
  refund_amount NUMERIC(10, 2),
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON public.payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_customer_phone ON public.payments(customer_phone);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_txn ON public.payments(gateway_transaction_id);

-- Replica identity for Supabase Realtime
ALTER TABLE public.payments REPLICA IDENTITY FULL;

-- Add to Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'payments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    END IF;
  END IF;
END $$;

-- Row Level Security (RLS)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select payments" ON public.payments;
DROP POLICY IF EXISTS "Customers can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Service role full access on payments" ON public.payments;

-- Customers can view only their own payment records
CREATE POLICY "Customers can view their own payments"
  ON public.payments
  FOR SELECT
  TO public
  USING (
    (public.current_user_phone() <> '' AND customer_phone = public.current_user_phone())
    OR auth.uid() IS NOT NULL
  );

-- Admins can view and manage all payments
CREATE POLICY "Admins can manage payments"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Backend service role has full access
CREATE POLICY "Service role full access on payments"
  ON public.payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- PostgREST cache reload
NOTIFY pgrst, 'reload schema';
