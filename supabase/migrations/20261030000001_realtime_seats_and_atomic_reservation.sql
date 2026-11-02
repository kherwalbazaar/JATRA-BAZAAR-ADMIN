-- ============================================================
-- Migration 010: Supabase Realtime for Seats & Secure Atomic Reservation RPC
-- JATRA BAZAAR — Global Real-Time Seat Synchronization (Production Hardened)
--
-- Security & Integrity Highlights:
-- 1. Configures Supabase Realtime publication without silently swallowing errors.
-- 2. Sets REPLICA IDENTITY FULL on public.seats for complete payload delivery.
-- 3. Closes dangerous public INSERT and UPDATE policies on public.seats.
-- 4. Preserves customer seat-map SELECT access for anon and authenticated users.
-- 5. Atomic RPCs (SECURITY DEFINER with fixed search_path = public, pg_temp):
--    - hold_seat_atomic(): Row-level locking (FOR UPDATE) prevents double-booking.
--    - release_seat_atomic(): Strict ownership check prevents cross-customer releases.
--    - release_expired_seat_holds(): Sweeps holds > 10m; NEVER touches booked seats.
-- 6. Safe & idempotent: clean DROP IF EXISTS avoids signature collision errors.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Configure Supabase Realtime publication on public.seats
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'seats'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;
    END IF;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE public.seats;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Enable REPLICA IDENTITY FULL on public.seats
-- Ensures UPDATE and DELETE events carry the full row payload for Realtime filtering.
-- ----------------------------------------------------------------------------
ALTER TABLE public.seats REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- 3. Row Level Security (RLS) on public.seats
-- Customers can view seats, but direct INSERT/UPDATE via REST API is blocked.
-- Seat state modifications MUST go through atomic RPCs or service_role.
-- ----------------------------------------------------------------------------
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- Clean up any insecure or legacy policies
DROP POLICY IF EXISTS "Allow anon and authenticated select seats" ON public.seats;
DROP POLICY IF EXISTS "Allow anon and authenticated update seats" ON public.seats;
DROP POLICY IF EXISTS "Allow anon and authenticated insert seats" ON public.seats;
DROP POLICY IF EXISTS "Public can view seats" ON public.seats;
DROP POLICY IF EXISTS "Admins can insert seats" ON public.seats;
DROP POLICY IF EXISTS "Admins can update seats" ON public.seats;
DROP POLICY IF EXISTS "Admins can delete seats" ON public.seats;
DROP POLICY IF EXISTS "Service role full access on seats" ON public.seats;

-- Customer Read-Only Policy: customers need SELECT to render the seat map
CREATE POLICY "Public can view seats"
  ON public.seats
  FOR SELECT
  TO public
  USING (true);

-- Admin Management Policies (authenticated users with admin privileges)
CREATE POLICY "Admins can insert seats"
  ON public.seats
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update seats"
  ON public.seats
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete seats"
  ON public.seats
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Backend / Service Role Full Access (for server-side route handlers)
CREATE POLICY "Service role full access on seats"
  ON public.seats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. High-Performance Indexes for Real-Time Queries and Filtering
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_seats_event_status ON public.seats(event_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_event_block_row ON public.seats(event_id, block_id, row_id);
CREATE INDEX IF NOT EXISTS idx_seats_reserved_status ON public.seats(event_id, status, reserved_at);
CREATE INDEX IF NOT EXISTS idx_seats_lookup_id ON public.seats(event_id, seat_id);
CREATE INDEX IF NOT EXISTS idx_seats_lookup_label ON public.seats(event_id, seat_label);

-- ----------------------------------------------------------------------------
-- 5. Atomic Seat Reservation Procedure (hold_seat_atomic)
-- Eliminates double-booking race conditions using PostgreSQL row-level locks (FOR UPDATE).
-- Succeeds ONLY when the seat is available (or held by the same customer session).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.hold_seat_atomic(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.hold_seat_atomic(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.hold_seat_atomic(
  p_event_id TEXT,
  p_seat_id TEXT,
  p_session_id TEXT,
  p_block_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_seat RECORD;
  v_now TIMESTAMPTZ := now();
  v_hold_ttl INTERVAL := INTERVAL '10 minutes';
BEGIN
  -- Validate required parameters
  IF p_event_id IS NULL OR trim(p_event_id) = '' OR
     p_seat_id IS NULL OR trim(p_seat_id) = '' OR
     p_session_id IS NULL OR trim(p_session_id) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_PARAMS',
      'message', 'event_id, seat_id, and session_id are required'
    );
  END IF;

  -- Lock row with FOR UPDATE to eliminate concurrent double-booking races
  SELECT * INTO v_seat
  FROM public.seats
  WHERE event_id = p_event_id
    AND (
      id = p_seat_id
      OR id = (p_event_id || '_' || p_seat_id)
      OR seat_id = p_seat_id
      OR (block_id || '-' || row_id || '-' || seat_number) = p_seat_id
      OR (block_id || '-' || seat_label) = p_seat_id
      OR (p_block_id IS NOT NULL AND block_id = p_block_id AND (seat_label = p_seat_id OR seat_number::text = p_seat_id))
      OR (p_block_id IS NULL AND seat_label = p_seat_id)
    )
  ORDER BY
    CASE
      WHEN id = p_seat_id THEN 1
      WHEN id = (p_event_id || '_' || p_seat_id) THEN 2
      WHEN seat_id = p_seat_id THEN 3
      ELSE 4
    END
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SEAT_NOT_FOUND',
      'message', 'Selected seat could not be found for this event'
    );
  END IF;

  -- Check if already permanently booked or locked
  IF v_seat.status IN ('booked', 'sold', 'locked') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SEAT_ALREADY_RESERVED',
      'seat_id', v_seat.id,
      'seat_label', v_seat.seat_label,
      'message', 'This seat has just been reserved by another customer. Please select another seat.'
    );
  END IF;

  -- Check if actively held by ANOTHER customer (< 10 minutes TTL)
  IF v_seat.status = 'reserved'
     AND v_seat.reserved_at IS NOT NULL
     AND v_seat.reserved_at > (v_now - v_hold_ttl)
     AND COALESCE(v_seat.reserved_by, '') <> p_session_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SEAT_ALREADY_RESERVED',
      'seat_id', v_seat.id,
      'seat_label', v_seat.seat_label,
      'message', 'This seat has just been reserved by another customer. Please select another seat.'
    );
  END IF;

  -- Atomically reserve the seat (or refresh existing hold for the current session)
  UPDATE public.seats
  SET
    status = 'reserved',
    reserved_at = v_now,
    reserved_by = p_session_id,
    updated_at = v_now
  WHERE id = v_seat.id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_seat.id,
    'seat_id', COALESCE(v_seat.seat_id, v_seat.id),
    'seat_label', v_seat.seat_label,
    'block_id', v_seat.block_id,
    'row_id', v_seat.row_id,
    'seat_number', v_seat.seat_number,
    'status', 'reserved',
    'price', v_seat.price,
    'reserved_at', v_now,
    'reserved_by', p_session_id,
    'reserved_until', (v_now + v_hold_ttl)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 6. Atomic Seat Release Procedure (release_seat_atomic)
-- Enforces strict customer ownership: Customer A cannot release Customer B's reservation.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.release_seat_atomic(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.release_seat_atomic(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.release_seat_atomic(
  p_event_id TEXT,
  p_seat_id TEXT,
  p_session_id TEXT,
  p_block_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_seat RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Strict validation: session_id is required
  IF p_event_id IS NULL OR trim(p_event_id) = '' OR
     p_seat_id IS NULL OR trim(p_seat_id) = '' OR
     p_session_id IS NULL OR trim(p_session_id) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'released', false,
      'code', 'INVALID_PARAMS',
      'message', 'event_id, seat_id, and session_id are required'
    );
  END IF;

  SELECT * INTO v_seat
  FROM public.seats
  WHERE event_id = p_event_id
    AND (
      id = p_seat_id
      OR id = (p_event_id || '_' || p_seat_id)
      OR seat_id = p_seat_id
      OR (block_id || '-' || row_id || '-' || seat_number) = p_seat_id
      OR (block_id || '-' || seat_label) = p_seat_id
      OR (p_block_id IS NOT NULL AND block_id = p_block_id AND (seat_label = p_seat_id OR seat_number::text = p_seat_id))
      OR (p_block_id IS NULL AND seat_label = p_seat_id)
    )
  ORDER BY
    CASE
      WHEN id = p_seat_id THEN 1
      WHEN id = (p_event_id || '_' || p_seat_id) THEN 2
      WHEN seat_id = p_seat_id THEN 3
      ELSE 4
    END
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'released', false, 'code', 'SEAT_NOT_FOUND');
  END IF;

  -- NEVER release booked or confirmed seats
  IF v_seat.status IN ('booked', 'sold', 'locked') THEN
    RETURN jsonb_build_object(
      'success', false,
      'released', false,
      'code', 'SEAT_ALREADY_BOOKED',
      'message', 'Cannot release a confirmed booking'
    );
  END IF;

  -- Only release if currently reserved
  IF v_seat.status = 'reserved' THEN
    -- STRICT OWNERSHIP ENFORCEMENT: Only the reserving customer can release their hold
    IF v_seat.reserved_by IS DISTINCT FROM p_session_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'released', false,
        'code', 'NOT_OWNER',
        'message', 'You cannot release a seat reserved by another customer'
      );
    END IF;

    UPDATE public.seats
    SET
      status = 'available',
      reserved_at = NULL,
      reserved_by = NULL,
      updated_at = v_now
    WHERE id = v_seat.id;

    RETURN jsonb_build_object(
      'success', true,
      'released', true,
      'id', v_seat.id,
      'seat_id', COALESCE(v_seat.seat_id, v_seat.id),
      'seat_label', v_seat.seat_label,
      'status', 'available'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'released', false, 'code', 'ALREADY_AVAILABLE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 7. Automated Reservation Expiry Sweep (release_expired_seat_holds)
-- Releases reservation holds older than 10 minutes back to 'available'.
-- GUARANTEE: Never touches booked seats (booking_id IS NULL AND booked_at IS NULL).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.release_expired_seat_holds();
DROP FUNCTION IF EXISTS public.release_expired_seat_holds(TEXT);

CREATE OR REPLACE FUNCTION public.release_expired_seat_holds(
  p_event_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_released_count INTEGER := 0;
BEGIN
  WITH expired_seats AS (
    UPDATE public.seats
    SET
      status = 'available',
      reserved_at = NULL,
      reserved_by = NULL,
      updated_at = v_now
    WHERE status = 'reserved'
      AND booking_id IS NULL
      AND booked_at IS NULL
      AND (reserved_at IS NULL OR reserved_at <= (v_now - INTERVAL '10 minutes'))
      AND (p_event_id IS NULL OR trim(p_event_id) = '' OR event_id = p_event_id)
    RETURNING id
  )
  SELECT count(*) INTO v_released_count FROM expired_seats;

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released_count,
    'event_id', p_event_id,
    'swept_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 8. Grant Execution Permissions
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.hold_seat_atomic(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_seat_atomic(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_seat_holds(TEXT) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. Reload PostgREST Schema Cache
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
