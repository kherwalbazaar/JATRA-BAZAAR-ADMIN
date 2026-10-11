-- ============================================================================
-- JATRA BAZAAR — Supabase Row-Level Security (RLS) & Atomic RPCs
-- Migration 000002: Production Hardened Security & Workflow Integration
-- ============================================================================
-- Security Hardening Summary:
-- 1. Anti-Privilege Escalation:
--    - Admin and Scanner checks strictly reject user_metadata.
--    - Admin privileges require internal admin_users table, app_metadata,
--      or service_role token.
-- 2. Trusted Pricing & Total Validation:
--    - book_seats_atomic() calculates seat prices, convenience fees (2.7%),
--      GST (18%), and platform charges (₹8) directly from database records.
--    - Rejects client underpayment or forged amounts.
-- 3. Anonymous Online Booking Protection:
--    - Online checkouts generate a cryptographically secure 256-bit booking_secret.
--    - Online bookings start as 'Pending' with seats held for 10 minutes.
--    - Payment confirmation is restricted to verified payment webhooks/admin RPC.
-- 4. Access Isolation on Sensitive Resources:
--    - POS counter revenue, operator details, and hardware settings are hidden
--      from public anon access.
--    - Customer PII (phone, email, booking lists) cannot be scraped by third parties.
-- 5. Scanner Authorization & Turnstile Integrity:
--    - Verifies approvalStatus = 'approved' and accountStatus = 'active'.
--    - Enforces assigned_event_id and assigned_gate_id constraints.
--    - Direct INSERT/UPDATE/DELETE on ticket_entries is denied; entries are
--      recorded strictly via verified scanning RPCs.
-- 6. Safe Search Path & Explicit Grants:
--    - All SECURITY DEFINER functions set `search_path = public, pg_temp`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECURITY HELPER FUNCTIONS (Hardened)
-- ----------------------------------------------------------------------------

-- Check if caller is an administrator (Never inspect user-editable user_metadata)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  -- 1. Service role always has administrative privileges
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN true;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- 2. Verify against internal admin_users table OR non-user-editable app_metadata
  RETURN (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- Check if caller is an active approved gate scanner
CREATE OR REPLACE FUNCTION public.is_active_scanner()
RETURNS boolean AS $$
BEGIN
  -- Administrators can always perform scanner operations
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    EXISTS (
      SELECT 1 FROM public.scanner_members
      WHERE user_id = auth.uid()
        AND approval_status = 'approved'
        AND account_status = 'active'
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'scanner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- Safely extract verified user email from JWT
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text AS $$
BEGIN
  RETURN COALESCE(auth.jwt() ->> 'email', '');
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp;

-- Safely extract verified user phone from JWT
CREATE OR REPLACE FUNCTION public.current_user_phone()
RETURNS text AS $$
BEGIN
  RETURN COALESCE(auth.jwt() ->> 'phone', '');
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY ON ALL 14 TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. EVENTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view events" ON public.events;
CREATE POLICY "Public can view events"
  ON public.events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins have full access to events" ON public.events;
CREATE POLICY "Admins have full access to events"
  ON public.events FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. BLOCK CATEGORIES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view block categories" ON public.block_categories;
CREATE POLICY "Public can view block categories"
  ON public.block_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins have full access to block categories" ON public.block_categories;
CREATE POLICY "Admins have full access to block categories"
  ON public.block_categories FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. GATES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view gates" ON public.gates;
CREATE POLICY "Public can view gates"
  ON public.gates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage gates" ON public.gates;
CREATE POLICY "Admins can manage gates"
  ON public.gates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. COUNTERS POLICIES (Protected — Revenue & Drawers Hidden From Public)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view counters" ON public.counters;
DROP POLICY IF EXISTS "Admins and staff can view counters" ON public.counters;
CREATE POLICY "Admins and staff can view counters"
  ON public.counters FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_active_scanner());

DROP POLICY IF EXISTS "Admins can manage counters" ON public.counters;
CREATE POLICY "Admins can manage counters"
  ON public.counters FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. TICKET TYPES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view ticket types" ON public.ticket_types;
CREATE POLICY "Public can view ticket types"
  ON public.ticket_types FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage ticket types" ON public.ticket_types;
CREATE POLICY "Admins can manage ticket types"
  ON public.ticket_types FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. SEATS POLICIES (Protected — Direct Client Updates Blocked)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view seats" ON public.seats;
CREATE POLICY "Public can view seats"
  ON public.seats FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert seats" ON public.seats;
CREATE POLICY "Admins can insert seats"
  ON public.seats FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update seats" ON public.seats;
CREATE POLICY "Admins can update seats"
  ON public.seats FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete seats" ON public.seats;
CREATE POLICY "Admins can delete seats"
  ON public.seats FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. BOOKINGS POLICIES (Protected — PII Isolated & Direct Insert Prohibited)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
CREATE POLICY "Admins can view all bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Customers can view their own bookings" ON public.bookings;
CREATE POLICY "Customers can view their own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    (public.current_user_phone() <> '' AND customer_phone = public.current_user_phone())
    OR (public.current_user_email() <> '' AND customer_email = public.current_user_email())
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- Direct client INSERT is prohibited to prevent forged/unpaid bookings.
-- All bookings must be routed through book_seats_atomic() or trusted backend server role.
DROP POLICY IF EXISTS "Admins and service role can insert bookings" ON public.bookings;
CREATE POLICY "Admins and service role can insert bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;
CREATE POLICY "Admins can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. TICKETS POLICIES (Protected — Direct Insert Prohibited)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and scanners can view all tickets" ON public.tickets;
CREATE POLICY "Admins and scanners can view all tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_active_scanner());

DROP POLICY IF EXISTS "Customers can view their own tickets" ON public.tickets;
CREATE POLICY "Customers can view their own tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    (public.current_user_phone() <> '' AND customer_phone = public.current_user_phone())
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = tickets.booking_doc_id
        AND (
          (public.current_user_phone() <> '' AND b.customer_phone = public.current_user_phone())
          OR (public.current_user_email() <> '' AND b.customer_email = public.current_user_email())
          OR (auth.uid() IS NOT NULL AND b.user_id = auth.uid())
        )
    )
  );

-- Direct client INSERT is prohibited. Tickets are issued exclusively by book_seats_atomic().
DROP POLICY IF EXISTS "Admins and service role can insert tickets" ON public.tickets;
CREATE POLICY "Admins and service role can insert tickets"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update tickets" ON public.tickets;
CREATE POLICY "Admins can update tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;
CREATE POLICY "Admins can delete tickets"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. SCANNER MEMBERS POLICIES (Protected — Staff PII Hidden From Public)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all scanner members" ON public.scanner_members;
CREATE POLICY "Admins can view all scanner members"
  ON public.scanner_members FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Scanners can view their own scanner profile" ON public.scanner_members;
CREATE POLICY "Scanners can view their own scanner profile"
  ON public.scanner_members FOR SELECT
  TO authenticated
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can manage scanner members" ON public.scanner_members;
CREATE POLICY "Admins can manage scanner members"
  ON public.scanner_members FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 10. TICKET ENTRIES POLICIES (Immutable Turnstile Scan History)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and scanners can view ticket entries" ON public.ticket_entries;
CREATE POLICY "Admins and scanners can view ticket entries"
  ON public.ticket_entries FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_active_scanner());

-- Direct client INSERT is prohibited. Entries are written exclusively via verify_ticket_scan().
DROP POLICY IF EXISTS "Admins and scanners can record ticket entries" ON public.ticket_entries;
DROP POLICY IF EXISTS "Only admins or scan RPC can insert ticket entries" ON public.ticket_entries;
CREATE POLICY "Only admins or scan RPC can insert ticket entries"
  ON public.ticket_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Ticket entries are immutable — updates and deletes are denied to everyone
DROP POLICY IF EXISTS "Disallow updates to ticket entries" ON public.ticket_entries;
DROP POLICY IF EXISTS "Disallow deletes to ticket entries" ON public.ticket_entries;

-- ----------------------------------------------------------------------------
-- 11. SETTINGS POLICIES (Protected — Hardware Credentials Hidden)
-- ----------------------------------------------------------------------------
-- Only public event form layout is readable by public; hardware POS config is hidden
DROP POLICY IF EXISTS "Public can view settings" ON public.settings;
DROP POLICY IF EXISTS "Public can view public form formats" ON public.settings;
CREATE POLICY "Public can view public form formats"
  ON public.settings FOR SELECT
  USING (id = 'createEventFormat' OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 12. AUDIT LOGS POLICIES (Immutable Audit Trail)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Direct client INSERT is prohibited. Audit logs are written via server procedures.
DROP POLICY IF EXISTS "Authenticated users can record audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Only admins or procedures can record audit logs" ON public.audit_logs;
CREATE POLICY "Only admins or procedures can record audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Audit logs are immutable
DROP POLICY IF EXISTS "Disallow updates to audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Disallow deletes to audit logs" ON public.audit_logs;

-- ----------------------------------------------------------------------------
-- 13. BANNERS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active banners" ON public.banners;
CREATE POLICY "Public can view active banners"
  ON public.banners FOR SELECT
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
CREATE POLICY "Admins can manage banners"
  ON public.banners FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 14. ADMIN USERS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage admin users" ON public.admin_users;
CREATE POLICY "Admins can manage admin users"
  ON public.admin_users FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- HIGH-CONCURRENCY TRANSACTION FUNCTIONS (Hardened RPC)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Customer Interactive Seat Hold Procedures
-- Used during live browsing / seat map selection before checkout.
-- Enforces:
-- 1. 10-minute hold expiration (TTL).
-- 2. Prevents overwriting seats booked by others or held by another session.
-- 3. Supports UUID, seat_label, and composite block-seat identifiers.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hold_seat_atomic(
  p_event_id TEXT,
  p_seat_id TEXT,
  p_session_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_seat RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_event_id IS NULL OR p_seat_id IS NULL OR p_session_id IS NULL OR trim(p_session_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_params', 'message', 'Event ID, seat ID, and session ID are required');
  END IF;

  SELECT id, seat_label, status, reserved_at, reserved_by, price INTO v_seat
  FROM public.seats
  WHERE event_id = p_event_id
    AND (
      id = p_seat_id
      OR seat_label = p_seat_id
      OR (block_id || '-' || seat_label) = p_seat_id
      OR (block_id || '-' || row_id || '-' || seat_number) = p_seat_id
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found', 'message', 'Seat not found');
  END IF;

  IF v_seat.status IN ('booked', 'sold', 'locked') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_booked', 'message', 'Seat is already booked');
  END IF;

  IF v_seat.status = 'reserved'
     AND v_seat.reserved_at > (v_now - INTERVAL '10 minutes')
     AND COALESCE(v_seat.reserved_by, '') <> p_session_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'held_by_other', 'message', 'Seat is temporarily held by another customer');
  END IF;

  UPDATE public.seats
  SET
    status = 'reserved',
    reserved_at = v_now,
    reserved_by = p_session_id,
    updated_at = v_now
  WHERE id = v_seat.id;

  RETURN jsonb_build_object(
    'success', true,
    'seat_id', v_seat.id,
    'seat_label', v_seat.seat_label,
    'price', v_seat.price,
    'reserved_until', (v_now + INTERVAL '10 minutes')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.hold_seat_atomic(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hold_seat_atomic(TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.hold_seats_atomic(
  p_event_id TEXT,
  p_seat_ids TEXT[],
  p_session_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_sid TEXT;
  v_res JSONB;
  v_held_count INTEGER := 0;
BEGIN
  IF p_seat_ids IS NULL OR array_length(p_seat_ids, 1) IS NULL OR array_length(p_seat_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No seat IDs provided');
  END IF;

  FOREACH v_sid IN ARRAY p_seat_ids LOOP
    v_res := public.hold_seat_atomic(p_event_id, v_sid, p_session_id);
    IF (v_res ->> 'success')::boolean THEN
      v_held_count := v_held_count + 1;
    ELSE
      PERFORM public.release_seats_atomic(p_event_id, p_seat_ids, p_session_id);
      RETURN jsonb_build_object(
        'success', false,
        'failed_seat_id', v_sid,
        'reason', v_res ->> 'reason',
        'message', v_res ->> 'message'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'held_count', v_held_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.hold_seats_atomic(TEXT, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hold_seats_atomic(TEXT, TEXT[], TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Customer Seat Hold Release Procedures (Deselection / Exit)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.release_seat_atomic(
  p_event_id TEXT,
  p_seat_id TEXT,
  p_session_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_seat RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_event_id IS NULL OR p_seat_id IS NULL OR p_session_id IS NULL OR trim(p_session_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_params');
  END IF;

  SELECT id, status, reserved_by INTO v_seat
  FROM public.seats
  WHERE event_id = p_event_id
    AND (
      id = p_seat_id
      OR seat_label = p_seat_id
      OR (block_id || '-' || seat_label) = p_seat_id
      OR (block_id || '-' || row_id || '-' || seat_number) = p_seat_id
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'not_found_noop');
  END IF;

  IF v_seat.status = 'reserved' AND v_seat.reserved_by = p_session_id THEN
    UPDATE public.seats
    SET
      status = 'available',
      reserved_at = NULL,
      reserved_by = NULL,
      updated_at = v_now
    WHERE id = v_seat.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.release_seat_atomic(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_seat_atomic(TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_seats_atomic(
  p_event_id TEXT,
  p_seat_ids TEXT[],
  p_session_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_sid TEXT;
BEGIN
  IF p_seat_ids IS NULL OR array_length(p_seat_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  FOREACH v_sid IN ARRAY p_seat_ids LOOP
    PERFORM public.release_seat_atomic(p_event_id, v_sid, p_session_id);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.release_seats_atomic(TEXT, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_seats_atomic(TEXT, TEXT[], TEXT) TO anon, authenticated;

-- Atomic Seat Hold & Booking Procedure
-- 1. Validates event existence and sales status
-- 2. Locks candidate seats (FOR UPDATE) and checks belonging and availability
-- 3. Calculates trusted pricing (Ticket Amount + Convenience Fee 2.7% + GST 18% + Platform ₹8)
-- 4. Validates customer payload and enforces payment authorization rules
-- 5. Generates 256-bit cryptographically secure booking_secret for anonymous online checkouts
CREATE OR REPLACE FUNCTION public.book_seats_atomic(
  p_event_id TEXT,
  p_seat_ids TEXT[],  -- Array of seat IDs to book
  p_booking JSONB,    -- Booking payload
  p_tickets JSONB[]   -- Array of TicketItem payloads
)
RETURNS JSONB AS $$
DECLARE
  v_seat RECORD;
  v_seat_count INTEGER;
  v_locked_count INTEGER := 0;
  v_taken_count INTEGER := 0;
  v_ticket JSONB;
  v_booking_id TEXT;
  v_ticket_number TEXT;
  v_customer_name TEXT;
  v_customer_phone TEXT;
  v_source TEXT;
  v_is_admin BOOLEAN;
  v_event_status TEXT;
  v_now TIMESTAMPTZ := now();
  v_distinct_seats INTEGER;
  v_booking_secret TEXT;
  v_matched_ids TEXT[] := ARRAY[]::TEXT[];

  -- Trusted database pricing calculation
  v_calculated_ticket_amount NUMERIC(12, 2) := 0.00;
  v_convenience_fee NUMERIC(12, 2) := 0.00;
  v_gst_on_convenience_fee NUMERIC(12, 2) := 0.00;
  v_platform_charge NUMERIC(12, 2) := 0.00;
  v_total_fees NUMERIC(12, 2) := 0.00;
  v_final_customer_amount NUMERIC(12, 2) := 0.00;
  v_unit_price NUMERIC(10, 2) := 0.00;
BEGIN
  v_is_admin := public.is_admin();

  -- 1. Validate Event Existence and Status
  SELECT status INTO v_event_status
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found', p_event_id;
  END IF;

  IF v_event_status NOT IN ('active', 'upcoming') THEN
    RAISE EXCEPTION 'Event % is not open for ticket sales (status: %)', p_event_id, v_event_status;
  END IF;

  -- 2. Validate Seat List
  IF p_seat_ids IS NULL OR array_length(p_seat_ids, 1) IS NULL OR array_length(p_seat_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Seat list cannot be empty';
  END IF;

  v_seat_count := array_length(p_seat_ids, 1);

  -- Verify no duplicate seat IDs were passed
  SELECT count(DISTINCT s) INTO v_distinct_seats
  FROM unnest(p_seat_ids) s;

  IF v_distinct_seats <> v_seat_count THEN
    RAISE EXCEPTION 'Duplicate seat IDs passed in booking request';
  END IF;

  -- 3. Validate Booking Payload Fields
  v_customer_name := trim(COALESCE(p_booking ->> 'customer_name', ''));
  v_customer_phone := trim(COALESCE(p_booking ->> 'customer_phone', ''));
  v_ticket_number := trim(COALESCE(p_booking ->> 'ticket_number', ''));
  v_source := COALESCE(p_booking ->> 'source', 'Counter');

  IF v_customer_name = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;

  IF v_customer_phone = '' THEN
    RAISE EXCEPTION 'Customer phone is required';
  END IF;

  IF v_ticket_number = '' THEN
    RAISE EXCEPTION 'Ticket number is required';
  END IF;

  -- Prevent duplicate ticket/booking numbers
  IF EXISTS (SELECT 1 FROM public.bookings WHERE ticket_number = v_ticket_number) THEN
    RAISE EXCEPTION 'Booking with ticket number % already exists', v_ticket_number;
  END IF;

  -- Verify ticket payload count matches seat count
  IF p_tickets IS NULL OR array_length(p_tickets, 1) <> v_seat_count THEN
    RAISE EXCEPTION 'Ticket payloads count (%) must match requested seats count (%)',
      COALESCE(array_length(p_tickets, 1), 0), v_seat_count;
  END IF;

  -- 4. Payment & Source Authorization Check
  -- Box Office Counter bookings can only be performed by administrators/authorized counter operators
  IF v_source = 'Counter' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Box Office Counter bookings must be performed by authorized staff';
  END IF;

  -- Online bookings: cannot be marked 'Confirmed' / 'Successful' unless caller is admin / trusted server role
  IF v_source = 'Online' AND NOT v_is_admin THEN
    IF (p_booking ->> 'payment_status') = 'Successful' OR (p_booking ->> 'status') = 'Confirmed' THEN
      RAISE EXCEPTION 'Online bookings cannot be confirmed directly without trusted payment verification';
    END IF;
  END IF;

  -- 5. Lock and Inspect Requested Seats (FOR UPDATE)
  -- Accumulate trusted seat prices directly from database records.
  -- Matches by UUID (id), seat_label (e.g. 'A1'), or composite key (e.g. 'B1-A-1').
  FOR v_seat IN
    SELECT id, seat_label, status, price, reserved_at, reserved_by
    FROM public.seats
    WHERE event_id = p_event_id
      AND (
        id = ANY(p_seat_ids)
        OR seat_label = ANY(p_seat_ids)
        OR (block_id || '-' || seat_label) = ANY(p_seat_ids)
        OR (block_id || '-' || row_id || '-' || seat_number) = ANY(p_seat_ids)
      )
    FOR UPDATE
  LOOP
    v_locked_count := v_locked_count + 1;
    v_matched_ids := array_append(v_matched_ids, v_seat.id);
    v_calculated_ticket_amount := v_calculated_ticket_amount + COALESCE(v_seat.price, 100.00);

    -- A seat is unavailable if booked/sold or currently reserved (< 10 minutes) by someone else
    IF v_seat.status IN ('booked', 'sold', 'locked') THEN
      v_taken_count := v_taken_count + 1;
    ELSIF v_seat.status = 'reserved'
          AND v_seat.reserved_at > (v_now - INTERVAL '10 minutes')
          AND COALESCE(v_seat.reserved_by, '') <> v_customer_phone THEN
      v_taken_count := v_taken_count + 1;
    END IF;
  END LOOP;

  -- Verify that EVERY requested seat exists and belongs to this specific event
  IF v_locked_count <> v_seat_count THEN
    RAISE EXCEPTION 'One or more requested seats do not exist for event % (expected %, found %)',
      p_event_id, v_seat_count, v_locked_count;
  END IF;

  IF v_taken_count > 0 THEN
    RAISE EXCEPTION 'One or more selected seats are already booked or held by another customer';
  END IF;

  -- 6. Calculate Trusted Pricing (Gateway-Independent Pricing System)
  IF v_source = 'Counter' THEN
    -- Box Office sales have zero gateway/platform charges
    v_convenience_fee := 0.00;
    v_gst_on_convenience_fee := 0.00;
    v_platform_charge := 0.00;
    v_total_fees := 0.00;
    v_final_customer_amount := v_calculated_ticket_amount;
  ELSE
    -- Online sales: 2.70% convenience fee + 18% GST on convenience fee + ₹8.00 platform charge
    v_convenience_fee := ROUND((v_calculated_ticket_amount * 0.027)::numeric, 2);
    v_gst_on_convenience_fee := ROUND((v_convenience_fee * 0.18)::numeric, 2);
    v_platform_charge := 8.00;
    v_total_fees := v_convenience_fee + v_gst_on_convenience_fee + v_platform_charge;
    v_final_customer_amount := v_calculated_ticket_amount + v_total_fees;
  END IF;

  v_unit_price := ROUND((v_calculated_ticket_amount / v_seat_count)::numeric, 2);

  -- Validate against client-provided payment amounts (prevent underpayment or price manipulation)
  IF (p_booking ->> 'final_customer_amount') IS NOT NULL
     AND ((p_booking ->> 'final_customer_amount')::numeric < (v_final_customer_amount - 0.05)) THEN
    RAISE EXCEPTION 'Price tampering detected: client amount (%) does not match required total (%)',
      (p_booking ->> 'final_customer_amount')::numeric, v_final_customer_amount;
  END IF;

  -- Generate 256-bit cryptographically secure booking secret for anonymous online checkouts
  v_booking_secret := encode(gen_random_bytes(32), 'hex');

  -- 7. Insert Booking Record
  v_booking_id := COALESCE(p_booking ->> 'id', gen_random_uuid()::text);
  INSERT INTO public.bookings (
    id, ticket_number, event_id, event_name, customer_name, customer_phone,
    customer_email, user_id, ticket_type_id, ticket_type_name, quantity, unit_price,
    amount, source, counter_name, payment_method, date, time, status,
    booking_status, assigned_gate, block, seats, ticket_amount, base_amount,
    convenience_fee, gst_on_convenience_fee, platform_charge, total_fees,
    final_customer_amount, payment_status, payment_channel, gateway_transaction_id,
    booking_secret, created_at, updated_at
  ) VALUES (
    v_booking_id,
    v_ticket_number,
    p_event_id,
    p_booking ->> 'event_name',
    v_customer_name,
    v_customer_phone,
    p_booking ->> 'customer_email',
    auth.uid(),
    p_booking ->> 'ticket_type_id',
    p_booking ->> 'ticket_type_name',
    v_seat_count,
    v_unit_price,
    v_final_customer_amount,
    v_source,
    p_booking ->> 'counter_name',
    COALESCE(p_booking ->> 'payment_method', CASE WHEN v_source = 'Online' THEN 'UPI' ELSE 'Cash' END),
    p_booking ->> 'date',
    p_booking ->> 'time',
    CASE WHEN v_source = 'Counter' OR v_is_admin THEN 'Confirmed' ELSE 'Pending' END,
    CASE WHEN v_source = 'Counter' OR v_is_admin THEN 'Confirmed' ELSE 'Pending' END,
    COALESCE(p_booking ->> 'assigned_gate', 'Main Gate'),
    p_booking ->> 'block',
    COALESCE(p_booking -> 'seats', '[]'::jsonb),
    v_calculated_ticket_amount,
    v_calculated_ticket_amount,
    v_convenience_fee,
    v_gst_on_convenience_fee,
    v_platform_charge,
    v_total_fees,
    v_final_customer_amount,
    CASE WHEN v_source = 'Counter' OR v_is_admin THEN 'Successful' ELSE 'Pending' END,
    v_source,
    p_booking ->> 'gateway_transaction_id',
    v_booking_secret,
    v_now,
    v_now
  );

  -- 8. Insert Individual Ticket Records
  FOREACH v_ticket IN ARRAY p_tickets LOOP
    IF v_ticket ->> 'id' IS NULL OR trim(v_ticket ->> 'id') = '' THEN
      RAISE EXCEPTION 'Ticket ID cannot be empty';
    END IF;
    IF v_ticket ->> 'qr_token' IS NULL OR trim(v_ticket ->> 'qr_token') = '' THEN
      RAISE EXCEPTION 'Ticket QR token cannot be empty';
    END IF;

    INSERT INTO public.tickets (
      id, ticket_id, booking_id, booking_doc_id, ticket_index, total_tickets,
      event_id, event_name, ticket_type_id, ticket_type_name, seat, block,
      assigned_gate, customer_name, customer_phone, serial_number, qr_token,
      status, date, time, unit_price, created_at, updated_at
    ) VALUES (
      v_ticket ->> 'id',
      v_ticket ->> 'ticket_id',
      v_ticket_number,
      v_booking_id,
      COALESCE((v_ticket ->> 'ticket_index')::integer, 1),
      v_seat_count,
      p_event_id,
      COALESCE(v_ticket ->> 'event_name', p_booking ->> 'event_name'),
      v_ticket ->> 'ticket_type_id',
      v_ticket ->> 'ticket_type_name',
      v_ticket ->> 'seat',
      v_ticket ->> 'block',
      COALESCE(v_ticket ->> 'assigned_gate', 'Main Gate'),
      v_customer_name,
      v_customer_phone,
      v_ticket ->> 'serial_number',
      v_ticket ->> 'qr_token',
      CASE WHEN v_source = 'Counter' OR v_is_admin THEN 'ACTIVE' ELSE 'PENDING_PAYMENT' END,
      v_ticket ->> 'date',
      v_ticket ->> 'time',
      v_unit_price,
      v_now,
      v_now
    );
  END LOOP;

  -- 9. Update Seat Hold / Booking State
  IF v_source = 'Counter' OR v_is_admin THEN
    UPDATE public.seats
    SET
      status = 'booked',
      booked_at = v_now,
      booking_id = v_ticket_number,
      reserved_at = NULL,
      reserved_by = NULL,
      updated_at = v_now
    WHERE event_id = p_event_id
      AND id = ANY(v_matched_ids);
  ELSE
    -- Online customer temporary 10-minute hold
    UPDATE public.seats
    SET
      status = 'reserved',
      reserved_at = v_now,
      reserved_by = v_customer_phone,
      booking_id = v_ticket_number,
      updated_at = v_now
    WHERE event_id = p_event_id
      AND id = ANY(v_matched_ids);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'ticket_number', v_ticket_number,
    'booking_secret', v_booking_secret,
    'status', CASE WHEN v_source = 'Counter' OR v_is_admin THEN 'Confirmed' ELSE 'Pending' END,
    'seats_booked', v_seat_count,
    'ticket_amount', v_calculated_ticket_amount,
    'total_fees', v_total_fees,
    'final_customer_amount', v_final_customer_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Revoke default public execution rights and grant only to necessary roles
REVOKE EXECUTE ON FUNCTION public.book_seats_atomic(TEXT, TEXT[], JSONB, JSONB[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_seats_atomic(TEXT, TEXT[], JSONB, JSONB[]) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trusted Online Payment Confirmation Procedure
-- (Invoked strictly by payment gateway webhook handler or admin action)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_online_payment_atomic(
  p_booking_id TEXT,
  p_gateway_transaction_id TEXT,
  p_payment_method TEXT DEFAULT 'UPI'
)
RETURNS JSONB AS $$
DECLARE
  v_booking RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Strict Admin / Service-Role authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only trusted administrators or payment webhooks can confirm payments';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id OR ticket_number = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- 1. Update Booking Status
  UPDATE public.bookings
  SET
    status = 'Confirmed',
    booking_status = 'Confirmed',
    payment_status = 'Successful',
    payment_method = p_payment_method,
    gateway_transaction_id = p_gateway_transaction_id,
    payment_date = v_now,
    updated_at = v_now
  WHERE id = v_booking.id;

  -- 2. Activate Issued Tickets
  UPDATE public.tickets
  SET
    status = 'ACTIVE',
    updated_at = v_now
  WHERE booking_doc_id = v_booking.id OR booking_id = v_booking.ticket_number;

  -- 3. Transition Reserved Seats to Booked
  UPDATE public.seats
  SET
    status = 'booked',
    booked_at = v_now,
    reserved_at = NULL,
    reserved_by = NULL,
    updated_at = v_now
  WHERE event_id = v_booking.event_id
    AND booking_id = v_booking.ticket_number;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'ticket_number', v_booking.ticket_number,
    'status', 'Confirmed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.confirm_online_payment_atomic(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_online_payment_atomic(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_online_payment_atomic(TEXT, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- Safe Customer Booking Token Lookup (For Anonymous Online Receipt Display)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_booking_by_token(
  p_ticket_number TEXT,
  p_booking_secret TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_booking RECORD;
  v_tickets JSONB;
BEGIN
  IF p_ticket_number IS NULL OR p_booking_secret IS NULL OR trim(p_booking_secret) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid credentials');
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE ticket_number = p_ticket_number
    AND booking_secret = p_booking_secret;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not found');
  END IF;

  SELECT jsonb_agg(to_jsonb(t)) INTO v_tickets
  FROM public.tickets t
  WHERE t.booking_doc_id = v_booking.id OR t.booking_id = v_booking.ticket_number;

  RETURN jsonb_build_object(
    'success', true,
    'booking', to_jsonb(v_booking),
    'tickets', COALESCE(v_tickets, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_booking_by_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(TEXT, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Safe Guest Customer Bookings Lookup (For Customer App "My Tickets" Screen)
-- Allows anonymous customer devices to securely fetch their bookings and tickets
-- using client-persisted booking tokens (ticket_number + booking_secret).
-- Completely prevents unauthorized customer PII scraping.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_tickets(
  p_order_tokens JSONB -- Array of objects: [{"ticket_number": "NJ26-00001", "booking_secret": "abc..."}]
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_num TEXT;
  v_sec TEXT;
  v_bookings JSONB := '[]'::jsonb;
  v_tickets JSONB := '[]'::jsonb;
  v_b RECORD;
  v_t JSONB;
BEGIN
  IF p_order_tokens IS NULL OR jsonb_array_length(p_order_tokens) = 0 THEN
    RETURN jsonb_build_object('success', true, 'bookings', '[]'::jsonb, 'tickets', '[]'::jsonb);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_tokens) LOOP
    v_num := trim(COALESCE(v_item ->> 'ticket_number', v_item ->> 'ticketNumber', ''));
    v_sec := trim(COALESCE(v_item ->> 'booking_secret', v_item ->> 'bookingSecret', ''));

    IF v_num <> '' AND v_sec <> '' THEN
      SELECT * INTO v_b
      FROM public.bookings
      WHERE ticket_number = v_num
        AND booking_secret = v_sec;

      IF FOUND THEN
        v_bookings := v_bookings || jsonb_build_array(to_jsonb(v_b));

        SELECT jsonb_agg(to_jsonb(t)) INTO v_t
        FROM public.tickets t
        WHERE t.booking_doc_id = v_b.id OR t.booking_id = v_b.ticket_number;

        IF v_t IS NOT NULL THEN
          v_tickets := v_tickets || v_t;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'bookings', v_bookings,
    'tickets', v_tickets
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_customer_tickets(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_tickets(JSONB) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Atomic Scan Verification Procedure (Single Ticket)
-- Enforces:
-- 1. Active scanner account check
-- 2. Scanner assigned_event_id and assigned_gate_id constraints
-- 3. Gate tier access checks (assigned_ticket_types)
-- 4. Double scan lock and immutable entry recording
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_ticket_scan(
  p_event_id TEXT,
  p_ticket_id TEXT,
  p_scanner_id TEXT,
  p_gate_id TEXT,
  p_scanned_by_name TEXT DEFAULT 'Scanner'
)
RETURNS JSONB AS $$
DECLARE
  v_ticket RECORD;
  v_entry_key TEXT;
  v_gate RECORD;
  v_scanner_member RECORD;
  v_is_admin BOOLEAN;
  v_now TIMESTAMPTZ := now();
  v_scan_date TEXT;
  v_scan_time TEXT;
BEGIN
  v_is_admin := public.is_admin();

  -- 1. Authorization: Only verified active scanners or administrators can scan
  IF NOT (v_is_admin OR public.is_active_scanner()) THEN
    RAISE EXCEPTION 'Unauthorized: Caller must be an active approved scanner operator or administrator';
  END IF;

  -- 2. Verify scanner identity and permission constraints if not admin
  IF NOT v_is_admin THEN
    SELECT * INTO v_scanner_member
    FROM public.scanner_members
    WHERE user_id = auth.uid();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unauthorized: scanner operator account not found';
    END IF;

    IF v_scanner_member.approval_status <> 'approved' THEN
      RAISE EXCEPTION 'Unauthorized: scanner account approval status is %', v_scanner_member.approval_status;
    END IF;

    IF v_scanner_member.account_status <> 'active' THEN
      RAISE EXCEPTION 'Unauthorized: scanner account has been deactivated';
    END IF;

    -- Enforce event assignment constraint
    IF v_scanner_member.assigned_event_id IS NOT NULL
       AND v_scanner_member.assigned_event_id <> ''
       AND v_scanner_member.assigned_event_id <> p_event_id THEN
      RAISE EXCEPTION 'Scanner operator is not assigned to event %', p_event_id;
    END IF;

    -- Enforce gate assignment constraint
    IF v_scanner_member.assigned_gate_id IS NOT NULL
       AND v_scanner_member.assigned_gate_id <> ''
       AND v_scanner_member.assigned_gate_id <> p_gate_id THEN
      RAISE EXCEPTION 'Scanner operator is assigned to gate % and cannot scan at gate %',
        v_scanner_member.assigned_gate_id, p_gate_id;
    END IF;

    -- Force trusted scanner ID from database record rather than client param
    p_scanner_id := v_scanner_member.scanner_id;
    p_scanned_by_name := v_scanner_member.name;
  END IF;

  -- Format timestamps
  v_scan_date := to_char(v_now, 'YYYY-MM-DD');
  v_scan_time := to_char(v_now, 'HH12:MI:SS AM');

  -- 3. Validate Event Existence
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event % not found', p_event_id;
  END IF;

  -- 4. Validate Gate if provided
  IF p_gate_id IS NOT NULL AND p_gate_id <> '' THEN
    SELECT * INTO v_gate
    FROM public.gates
    WHERE event_id = p_event_id
      AND (id = p_gate_id OR name = p_gate_id);

    IF NOT FOUND THEN
      -- Record scan attempt with gate mismatch
      INSERT INTO public.ticket_entries (
        ticket_id, event_id, scanner_id, scanner_name, gate_id,
        entry_status, scan_result, scanned_at, scan_date, scan_time, message
      ) VALUES (
        p_ticket_id, p_event_id, p_scanner_id, p_scanned_by_name, p_gate_id,
        'rejected', 'INVALID', v_now, v_scan_date, v_scan_time, 'Gate does not exist for this event'
      );
      RETURN jsonb_build_object('result', 'INVALID', 'message', 'Gate is not registered for this event');
    END IF;
  END IF;

  -- 5. Lock and load ticket record
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE (id = p_ticket_id OR qr_token = p_ticket_id OR serial_number = p_ticket_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.ticket_entries (
      ticket_id, event_id, scanner_id, scanner_name, gate_id,
      entry_status, scan_result, scanned_at, scan_date, scan_time, message
    ) VALUES (
      p_ticket_id, p_event_id, p_scanner_id, p_scanned_by_name, p_gate_id,
      'rejected', 'INVALID', v_now, v_scan_date, v_scan_time, 'Ticket does not exist'
    );
    RETURN jsonb_build_object('result', 'INVALID', 'message', 'Invalid ticket token');
  END IF;

  -- 6. Check Event Mismatch
  IF v_ticket.event_id <> p_event_id THEN
    INSERT INTO public.ticket_entries (
      ticket_id, event_id, scanner_id, scanner_name, gate_id,
      entry_status, scan_result, scanned_at, scan_date, scan_time,
      booking_id, audience_name, message
    ) VALUES (
      v_ticket.id, p_event_id, p_scanner_id, p_scanned_by_name, p_gate_id,
      'rejected', 'WRONG_EVENT', v_now, v_scan_date, v_scan_time,
      v_ticket.booking_id, v_ticket.customer_name, 'Ticket is for a different event'
    );
    RETURN jsonb_build_object('result', 'WRONG_EVENT', 'message', 'Ticket belongs to another event');
  END IF;

  -- 7. Check Cancellation
  IF v_ticket.status = 'CANCELLED' THEN
    INSERT INTO public.ticket_entries (
      ticket_id, event_id, scanner_id, scanner_name, gate_id,
      entry_status, scan_result, scanned_at, scan_date, scan_time,
      booking_id, audience_name, message
    ) VALUES (
      v_ticket.id, p_event_id, p_scanner_id, p_scanned_by_name, p_gate_id,
      'rejected', 'CANCELLED', v_now, v_scan_date, v_scan_time,
      v_ticket.booking_id, v_ticket.customer_name, 'Ticket has been cancelled'
    );
    RETURN jsonb_build_object('result', 'CANCELLED', 'message', 'This ticket has been cancelled');
  END IF;

  -- 8. Check Unpaid
  IF v_ticket.status = 'PENDING_PAYMENT' THEN
    INSERT INTO public.ticket_entries (
      ticket_id, event_id, scanner_id, scanner_name, gate_id,
      entry_status, scan_result, scanned_at, scan_date, scan_time,
      booking_id, audience_name, message
    ) VALUES (
      v_ticket.id, p_event_id, p_scanner_id, p_scanned_by_name, p_gate_id,
      'rejected', 'UNPAID', v_now, v_scan_date, v_scan_time,
      v_ticket.booking_id, v_ticket.customer_name, 'Ticket payment is pending'
    );
    RETURN jsonb_build_object('result', 'UNPAID', 'message', 'Ticket payment is pending confirmation');
  END IF;

  -- 9. Check Double-Scan / Already Used
  IF v_ticket.status = 'ENTERED' THEN
    INSERT INTO public.ticket_entries (
      ticket_id, event_id, scanner_id, scanner_name, gate_id,
      entry_status, scan_result, scanned_at, scan_date, scan_time,
      booking_id, audience_name, previous_entry_time, previous_scanner_id,
      previous_scanner_name, message
    ) VALUES (
      v_ticket.id, p_event_id, p_scanner_id, p_scanned_by_name, p_gate_id,
      'rejected', 'ALREADY_USED', v_now, v_scan_date, v_scan_time,
      v_ticket.booking_id, v_ticket.customer_name, v_ticket.scanned_at,
      v_ticket.scanned_by, v_ticket.scanner_member_name, 'Ticket was already scanned'
    );
    RETURN jsonb_build_object(
      'result', 'ALREADY_USED',
      'message', 'Ticket was already scanned',
      'previous_entry_time', v_ticket.scanned_at,
      'previous_scanner_name', v_ticket.scanner_member_name
    );
  END IF;

  -- 10. Check Gate Ticket Type Access
  IF v_gate.id IS NOT NULL AND v_gate.assigned_ticket_types IS NOT NULL AND jsonb_array_length(v_gate.assigned_ticket_types) > 0 THEN
    IF NOT (
      v_gate.assigned_ticket_types ? v_ticket.ticket_type_id
      OR v_gate.assigned_ticket_types ? v_ticket.ticket_type_name
    ) THEN
      INSERT INTO public.ticket_entries (
        ticket_id, event_id, scanner_id, scanner_name, gate_id,
        entry_status, scan_result, scanned_at, scan_date, scan_time,
        booking_id, audience_name, message
      ) VALUES (
        v_ticket.id, p_event_id, p_scanner_id, p_scanned_by_name, p_gate_id,
        'rejected', 'INVALID', v_now, v_scan_date, v_scan_time,
        v_ticket.booking_id, v_ticket.customer_name, 'Ticket type not allowed at this gate'
      );
      RETURN jsonb_build_object(
        'result', 'INVALID',
        'message', 'This ticket tier is not permitted at this gate. Allowed: ' || v_ticket.assigned_gate
      );
    END IF;
  END IF;

  -- 11. Valid Entry: Update ticket status
  v_entry_key := p_event_id || '__' || v_ticket.id;
  UPDATE public.tickets
  SET
    status = 'ENTERED',
    scanned_at = v_now,
    scanned_by = p_scanner_id,
    scanner_member_name = p_scanned_by_name,
    scan_gate_id = p_gate_id,
    scan_date = v_scan_date,
    scan_time = v_scan_time,
    updated_at = v_now
  WHERE id = v_ticket.id;

  -- 12. Record entry audit in ticket_entries
  INSERT INTO public.ticket_entries (
    entry_key, ticket_id, event_id, scanner_id, scanner_name, gate_id,
    entry_status, scan_result, scanned_at, scan_date, scan_time,
    booking_id, audience_name, ticket_type, seat, message
  ) VALUES (
    v_entry_key, v_ticket.id, p_event_id, p_scanner_id, p_scanned_by_name, p_gate_id,
    'entered', 'SUCCESS', v_now, v_scan_date, v_scan_time,
    v_ticket.booking_id, v_ticket.customer_name, v_ticket.ticket_type_name,
    v_ticket.seat, 'Entry granted'
  );

  -- 13. Update scanner member total scans tally
  UPDATE public.scanner_members
  SET
    total_scans = total_scans + 1,
    last_scan_at = v_now,
    updated_at = v_now
  WHERE scanner_id = p_scanner_id;

  -- 14. Update gate turnstile statistics
  IF v_gate.id IS NOT NULL THEN
    UPDATE public.gates
    SET
      entered = entered + 1,
      percentage = CASE WHEN capacity > 0 THEN ROUND(((entered + 1)::numeric / capacity) * 100) ELSE 0 END,
      status = CASE
        WHEN capacity > 0 AND (entered + 1) >= capacity THEN 'full'
        WHEN capacity > 0 AND (entered + 1) >= (capacity * 0.8) THEN 'congested'
        ELSE 'normal'
      END,
      updated_at = v_now
    WHERE id = v_gate.id;
  END IF;

  RETURN jsonb_build_object(
    'result', 'SUCCESS',
    'ticket_id', v_ticket.id,
    'customer_name', v_ticket.customer_name,
    'seat', v_ticket.seat,
    'block', v_ticket.block,
    'ticket_type', v_ticket.ticket_type_name,
    'scanned_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.verify_ticket_scan(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_ticket_scan(TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_ticket_scan(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- Atomic Batch Scan Verification Procedure (Multi-ticket Admission)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_batch_ticket_scan(
  p_event_id TEXT,
  p_ticket_ids TEXT[],
  p_booking_id TEXT,
  p_scanner_id TEXT,
  p_gate_id TEXT,
  p_scanned_by_name TEXT DEFAULT 'Scanner'
)
RETURNS JSONB AS $$
DECLARE
  v_tid TEXT;
  v_res JSONB;
  v_admitted_count INTEGER := 0;
  v_admitted_tickets JSONB := '[]'::jsonb;
  v_last_error TEXT := '';
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_ticket_ids IS NULL OR array_length(p_ticket_ids, 1) IS NULL OR array_length(p_ticket_ids, 1) = 0 THEN
    RETURN jsonb_build_object('result', 'INVALID', 'message', 'No tickets specified for admission');
  END IF;

  FOREACH v_tid IN ARRAY p_ticket_ids LOOP
    v_res := public.verify_ticket_scan(p_event_id, v_tid, p_scanner_id, p_gate_id, p_scanned_by_name);
    IF (v_res ->> 'result') = 'SUCCESS' THEN
      v_admitted_count := v_admitted_count + 1;
      v_admitted_tickets := v_admitted_tickets || jsonb_build_array(v_res);
    ELSE
      v_last_error := v_res ->> 'message';
    END IF;
  END LOOP;

  -- Update booking entered counts if booking_id was provided
  IF p_booking_id IS NOT NULL AND p_booking_id <> '' AND v_admitted_count > 0 THEN
    UPDATE public.bookings
    SET
      entered_count = entered_count + v_admitted_count,
      remaining_count = GREATEST(0, quantity - (entered_count + v_admitted_count)),
      used_tickets = used_tickets || to_jsonb(p_ticket_ids),
      used_at = v_now,
      updated_at = v_now
    WHERE id = p_booking_id OR ticket_number = p_booking_id;
  END IF;

  IF v_admitted_count > 0 THEN
    RETURN jsonb_build_object(
      'result', 'SUCCESS',
      'admitted_count', v_admitted_count,
      'total_requested', array_length(p_ticket_ids, 1),
      'admitted_tickets', v_admitted_tickets
    );
  ELSE
    RETURN jsonb_build_object(
      'result', 'REJECTED',
      'message', COALESCE(v_last_error, 'All ticket scans were rejected')
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.verify_batch_ticket_scan(TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_batch_ticket_scan(TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_batch_ticket_scan(TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- COMPATIBILITY VIEWS PERMISSIONS (Customer Project & Legacy Access)
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.shows TO anon, authenticated;
GRANT SELECT ON public.block_categories_view TO anon, authenticated;
GRANT SELECT ON public.ticket_types_view TO anon, authenticated;
GRANT SELECT ON public.banners_view TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- REALTIME PUBLICATION CONFIGURATION FOR CUSTOMER & ADMIN REACTIVITY
-- Enables PostgreSQL replication broadcasts for interactive seat maps,
-- real-time show status changes, banner announcements, and tier prices.
-- Wrapped in an idempotent exception handler so it can be re-run safely.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.banners;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.block_categories;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_types;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
