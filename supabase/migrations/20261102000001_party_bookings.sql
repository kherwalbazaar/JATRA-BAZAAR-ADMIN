-- ============================================================
-- Migration: Party Booking Management
-- JATRA BAZAAR — Committee ↔ Opera Party date bookings
--
-- Highlights:
-- 1. public.party_bookings stores ONE booking record per party+date slot.
--    Party/committee profiles stay in Firestore (settings/parties + events);
--    only Firestore document IDs are referenced here.
-- 2. Duplicate confirmed bookings are blocked at DB level by a partial
--    unique index; cancelled rows sit outside it, so history is retained and
--    the date is released for re-booking.
-- 3. RLS: customers (anon/authenticated) are READ-ONLY; all writes go through
--    service_role from the Admin Panel API routes. The read policy covers
--    Cancelled rows too so realtime cancel events reach the Customer Project.
-- 4. Realtime: table is added to supabase_realtime with FULL replica
--    identity so both apps can live-update party calendars on INSERT/UPDATE.
-- 5. Idempotent: safe to re-run.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.party_bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        text NOT NULL,
  party_name      text NOT NULL,
  committee_id    text,
  committee_name  text NOT NULL,
  committee_address text,
  event_name      text NOT NULL,
  event_address   text NOT NULL,
  contact_number  text,
  booking_date    date NOT NULL,
  status          text NOT NULL DEFAULT 'Confirmed'
                  CHECK (status IN ('Confirmed', 'Cancelled')),
  remarks         text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  cancelled_at    timestamptz
);

-- One confirmed booking per party per date. Cancelling removes the row from
-- the index, so the date becomes bookable again while the record survives.
CREATE UNIQUE INDEX IF NOT EXISTS uq_party_bookings_confirmed_slot
  ON public.party_bookings (party_id, booking_date)
  WHERE status = 'Confirmed';

CREATE INDEX IF NOT EXISTS idx_party_bookings_party_date
  ON public.party_bookings (party_id, booking_date DESC);

CREATE INDEX IF NOT EXISTS idx_party_bookings_status_date
  ON public.party_bookings (status, booking_date DESC);

-- ----------------------------------------------------------------------------
-- 2. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.party_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view confirmed party bookings" ON public.party_bookings;
DROP POLICY IF EXISTS "Public can view party bookings" ON public.party_bookings;
DROP POLICY IF EXISTS "Customers cannot modify party bookings" ON public.party_bookings;
DROP POLICY IF EXISTS "Service role full access on party_bookings" ON public.party_bookings;

-- Customer Project reads these rows (read-only). The predicate must also match
-- Cancelled rows: Supabase Realtime only delivers an UPDATE when the *new*
-- record passes the reader's SELECT policy, so a status flip to 'Cancelled'
-- would otherwise be silently dropped and the customer calendar would keep
-- showing the date as booked. Both apps still filter to Confirmed for display
-- (catalog loader + bookingsForParty), so cancelled rows are never rendered.
CREATE POLICY "Public can view party bookings"
  ON public.party_bookings
  FOR SELECT
  TO public
  USING (true);

-- Everything else is rejected for anon/authenticated (no INSERT/UPDATE/DELETE
-- policies exist), so customers cannot modify booking records.

-- Admin Panel API routes write exclusively with the service-role key.
CREATE POLICY "Service role full access on party_bookings"
  ON public.party_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. Realtime
-- ----------------------------------------------------------------------------
ALTER TABLE public.party_bookings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'party_bookings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.party_bookings;
    END IF;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE public.party_bookings;
  END IF;
END $$;
