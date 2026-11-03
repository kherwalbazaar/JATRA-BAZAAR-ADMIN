-- ============================================================
-- Follow-up: cancelled party bookings never reached the Customer Project.
--
-- Supabase Realtime only delivers an UPDATE when the *new* record passes the
-- reader's SELECT policy. The old policy was USING (status = 'Confirmed'), so
-- flipping a row to 'Cancelled' made it invisible to anon and the UPDATE event
-- was dropped — the customer party calendar kept painting the date red until a
-- manual refresh.
--
-- Reads cover all statuses; writes stay blocked (no INSERT/UPDATE/DELETE
-- policy for anon/authenticated) and both apps still filter to Confirmed for
-- display, so cancelled rows are never shown to customers.
-- Idempotent: safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS "Public can view confirmed party bookings" ON public.party_bookings;
DROP POLICY IF EXISTS "Public can view party bookings" ON public.party_bookings;

CREATE POLICY "Public can view party bookings"
  ON public.party_bookings
  FOR SELECT
  TO public
  USING (true);
