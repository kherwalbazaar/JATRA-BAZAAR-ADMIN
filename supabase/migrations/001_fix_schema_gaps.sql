-- Migration 001: Fix schema gaps for dual-write mirror
-- Run this in Supabase Dashboard → SQL Editor
-- Safe: only ADDs columns / creates tables. No data is touched.

-- ============================================================
-- 1. BOOKINGS — add missing columns
-- ============================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS show_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_time text;

-- ============================================================
-- 2. TICKETS — add missing columns
-- ============================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS show_id text;

-- ============================================================
-- 3. SEATS — add missing columns (canonical single-path model)
-- ============================================================
ALTER TABLE seats ADD COLUMN IF NOT EXISTS block text;
ALTER TABLE seats ADD COLUMN IF NOT EXISTS row text;
ALTER TABLE seats ADD COLUMN IF NOT EXISTS number integer;
ALTER TABLE seats ADD COLUMN IF NOT EXISTS show_id text;
ALTER TABLE seats ADD COLUMN IF NOT EXISTS ticket_type_id text;
ALTER TABLE seats ADD COLUMN IF NOT EXISTS seat_label text;
ALTER TABLE seats ADD COLUMN IF NOT EXISTS seat_id text;

-- ============================================================
-- 4. TICKET_TYPES — add missing columns
-- ============================================================
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS gate text;
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- ============================================================
-- 5. SCANNER_MEMBERS — add missing columns
-- ============================================================
ALTER TABLE scanner_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'scanner';
ALTER TABLE scanner_members ADD COLUMN IF NOT EXISTS event_id text;
ALTER TABLE scanner_members ADD COLUMN IF NOT EXISTS pin text;
ALTER TABLE scanner_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE scanner_members ADD COLUMN IF NOT EXISTS profile_photo text;
ALTER TABLE scanner_members ADD COLUMN IF NOT EXISTS gate_id text;
ALTER TABLE scanner_members ADD COLUMN IF NOT EXISTS total_scans integer DEFAULT 0;
ALTER TABLE scanner_members ADD COLUMN IF NOT EXISTS last_scan_at text;

-- ============================================================
-- 6. TICKET_ENTRIES — add missing columns (scan log shape)
-- ============================================================
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS entry_status text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS scan_result text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS scanner_name text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS gate_id text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS ticket_id text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS booking_id text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS seat text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS audience_name text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS persons integer DEFAULT 1;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS ticket_type text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS previous_entry_time text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS previous_scanner_id text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS previous_scanner_name text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS previous_gate_id text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS booking_source text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS scan_date text;
ALTER TABLE ticket_entries ADD COLUMN IF NOT EXISTS scan_time text;

-- ============================================================
-- 7. GATES — add missing columns
-- ============================================================
ALTER TABLE gates ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 0;
ALTER TABLE gates ADD COLUMN IF NOT EXISTS entered integer DEFAULT 0;
ALTER TABLE gates ADD COLUMN IF NOT EXISTS percentage numeric DEFAULT 0;

-- ============================================================
-- 8. COUNTERS — add missing columns
-- ============================================================
ALTER TABLE counters ADD COLUMN IF NOT EXISTS event_id text;

-- ============================================================
-- 9. SETTINGS — add key/value or JSONB data column
-- ============================================================
ALTER TABLE settings ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS data jsonb;

-- ============================================================
-- 10. AUDIT_LOGS — add missing columns
-- ============================================================
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS performed_by text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS timestamp timestamptz DEFAULT now();

-- ============================================================
-- 11. EVENTS — add missing columns (event/show full shape)
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS additional_banners jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS audience text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sale_mode text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS day text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS entry_time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS actors text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS writer text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS director text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS music_director text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS singer text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_id text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_id text;

-- ============================================================
-- 12. SHOWS — same additions as events
-- ============================================================
ALTER TABLE shows ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS poster text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS additional_banners jsonb;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS audience text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS sale_mode text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS day text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS duration text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS entry_time text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS end_time text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS actors text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS writer text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS director text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS music_director text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS singer text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS show_id text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS event_id text;

-- ============================================================
-- 13. BLOCK_CATEGORIES — ensure full shape (already has data)
-- ============================================================
-- Columns already present: id, name, enabled, online, counter, builtin, display_order
-- Add 'order' alias if the app writes 'order' instead of 'display_order'
ALTER TABLE block_categories ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0;

-- ============================================================
-- 14. USERS profile table (for Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  role text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 15. Enable RLS on all tables
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 16. RLS Policies — public read, authenticated write
--    (tighten later when Supabase Auth is fully wired)
-- ============================================================

-- Public read for catalog data
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public read shows" ON shows FOR SELECT USING (true);
CREATE POLICY "Public read ticket_types" ON ticket_types FOR SELECT USING (true);
CREATE POLICY "Public read seats" ON seats FOR SELECT USING (true);
CREATE POLICY "Public read block_categories" ON block_categories FOR SELECT USING (true);
CREATE POLICY "Public read banners" ON banners FOR SELECT USING (true);
CREATE POLICY "Public read gates" ON gates FOR SELECT USING (true);
CREATE POLICY "Public read counters" ON counters FOR SELECT USING (true);
CREATE POLICY "Public read settings" ON settings FOR SELECT USING (true);

-- Authenticated full access (admin panel writes)
-- Using "true" temporarily so the publishable key can write during dual-write phase.
-- Tighten to auth.role() = 'authenticated' once Supabase Auth login is wired.
CREATE POLICY "Allow all events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all shows" ON shows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all seats" ON seats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ticket_types" ON ticket_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all scanner_members" ON scanner_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ticket_entries" ON ticket_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all gates" ON gates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all counters" ON counters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all block_categories" ON block_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all banners" ON banners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all users" ON users FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 17. Indexes for common lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ticket_number ON bookings(ticket_number);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_tickets_booking ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_seats_event ON seats(event_id);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);
CREATE INDEX IF NOT EXISTS idx_seats_booking ON seats(booking_id);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_ticket ON ticket_entries(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_event ON ticket_entries(event_id);
CREATE INDEX IF NOT EXISTS idx_scanner_members_scanner_id ON scanner_members(scanner_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_gates_event ON gates(event_id);
CREATE INDEX IF NOT EXISTS idx_counters_event ON counters(event_id);

-- Done.
SELECT 'Migration 001 complete' AS result;
