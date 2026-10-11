-- ============================================================================
-- JATRA BAZAAR — Supabase PostgreSQL Schema Migration
-- Migration 000001: Initial Core Schema & Dual-Structure Resolution (Hardened)
-- ============================================================================
-- Resolution of Dual Structures:
-- 1. Dual Event Structure ('events' vs 'shows'):
--    - Canonical table: 'events'.
--    - Backward-compatibility view: 'shows' (SELECT * FROM events).
--    - Supports text IDs (e.g. Firestore IDs) and UUIDs with gen_random_uuid().
-- 2. Dual Seat Structure ('shows/{id}/seats' vs 'seats/{id}/{block}/{row}-{n}'):
--    - Unified canonical table: 'seats'.
--    - Relational foreign key: events(id) ON DELETE CASCADE.
--    - Unique constraint: (event_id, block_id, row_id, seat_number) prevents
--      duplicate seat allocations and eliminates path synchronization drift.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generic updated_at trigger function (Hardened with explicit search_path)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 1. EVENTS (Canonical Festival / Theater Shows)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  event_title TEXT,
  committee_name TEXT,
  committee_location TEXT,
  party_name TEXT,
  language TEXT DEFAULT 'Santali',
  audience TEXT DEFAULT 'All Ages',
  sale_mode TEXT NOT NULL DEFAULT 'Counter' CHECK (sale_mode IN ('Online', 'Counter')),
  date DATE NOT NULL,
  day TEXT,
  time TEXT,
  entry_time TEXT,
  start_time TEXT,
  end_time TEXT,
  duration TEXT,
  venue TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('active', 'upcoming', 'completed', 'sold_out')),
  poster TEXT,
  additional_banners JSONB NOT NULL DEFAULT '[]'::jsonb,
  actors JSONB NOT NULL DEFAULT '[]'::jsonb,
  writer TEXT,
  director TEXT,
  music_director TEXT,
  singer TEXT,
  trailer_url TEXT,
  total_capacity INTEGER NOT NULL DEFAULT 0,
  tickets_sold INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  organizer TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_sale_mode ON public.events(sale_mode);

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backward-compatibility view for legacy code and Customer Project expecting 'shows'
-- Includes camelCase column aliases so older codebases and customer queries work seamlessly
CREATE OR REPLACE VIEW public.shows WITH (security_invoker = true) AS
  SELECT
    e.*,
    e.event_title AS "eventTitle",
    e.committee_name AS "committeeName",
    e.committee_location AS "committeeLocation",
    e.party_name AS "partyName",
    e.additional_banners AS "additionalBanners",
    e.additional_banners AS banners,
    e.entry_time AS "entryTime",
    e.start_time AS "startTime",
    e.end_time AS "endTime",
    e.music_director AS "musicDirector",
    e.trailer_url AS "trailerUrl",
    e.total_capacity AS "totalCapacity",
    e.tickets_sold AS "ticketsSold",
    e.total_revenue AS "totalRevenue"
  FROM public.events e;

-- ----------------------------------------------------------------------------
-- 2. BLOCK CATEGORIES (Stage Layout Seating Tiers & Selling Channels)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.block_categories (
  id TEXT PRIMARY KEY, -- e.g. 'A1', 'A2', 'B1', 'Gallery'
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  online BOOLEAN NOT NULL DEFAULT false,
  counter BOOLEAN NOT NULL DEFAULT true,
  builtin BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_block_categories_updated_at ON public.block_categories;
CREATE TRIGGER trg_block_categories_updated_at
  BEFORE UPDATE ON public.block_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the standard 9 venue block categories if not present
INSERT INTO public.block_categories (id, name, enabled, online, counter, builtin, display_order)
VALUES
  ('A1', 'A1', true, false, true, true, 1),
  ('A2', 'A2', true, false, true, true, 2),
  ('A3', 'A3', true, false, true, true, 3),
  ('B1', 'B1', true, false, true, true, 4),
  ('B2', 'B2', true, false, true, true, 5),
  ('B3', 'B3', true, false, true, true, 6),
  ('C1', 'C1', true, false, true, true, 7),
  ('C2', 'C2', true, false, true, true, 8),
  ('C3', 'C3', true, false, true, true, 9)
ON CONFLICT (id) DO NOTHING;

-- Backward-compatibility view for Customer Project block categories with 'order' alias
CREATE OR REPLACE VIEW public.block_categories_view WITH (security_invoker = true) AS
  SELECT
    bc.*,
    bc.display_order AS "order"
  FROM public.block_categories bc;

-- ----------------------------------------------------------------------------
-- 3. GATES (Festival Entry Turnstiles & Access Control Points)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entered INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#4f39f6',
  border_class TEXT,
  bg_light_class TEXT,
  text_class TEXT,
  bar_color TEXT,
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'congested', 'full')),
  assigned_ticket_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gates_event_id ON public.gates(event_id);

DROP TRIGGER IF EXISTS trg_gates_updated_at ON public.gates;
CREATE TRIGGER trg_gates_updated_at
  BEFORE UPDATE ON public.gates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. COUNTERS (Box Office POS Terminals)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'busy', 'offline')),
  tickets_sold INTEGER NOT NULL DEFAULT 0,
  cash_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  upi_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counters_event_id ON public.counters(event_id);

DROP TRIGGER IF EXISTS trg_counters_updated_at ON public.counters;
CREATE TRIGGER trg_counters_updated_at
  BEFORE UPDATE ON public.counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. TICKET TYPES (Pricing Tiers / Badges / Gate Access Quotas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  committee_name TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge_text TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_quota INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#4f39f6',
  bg_color TEXT DEFAULT '#eef2ff',
  text_color TEXT DEFAULT '#312e81',
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  gate_access JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON public.ticket_types(event_id);

DROP TRIGGER IF EXISTS trg_ticket_types_updated_at ON public.ticket_types;
CREATE TRIGGER trg_ticket_types_updated_at
  BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backward-compatibility view for Customer Project ticket types with camelCase aliases
CREATE OR REPLACE VIEW public.ticket_types_view WITH (security_invoker = true) AS
  SELECT
    tt.*,
    tt.event_id AS "eventId",
    tt.committee_name AS "committeeName",
    tt.badge_text AS "badgeText",
    tt.total_quota AS "totalQuota",
    tt.bg_color AS "bgColor",
    tt.text_color AS "textColor",
    tt.gate_access AS "gateAccess"
  FROM public.ticket_types tt;

-- ----------------------------------------------------------------------------
-- 6. SEATS (Stage Diagram Seats - Unified Relational Model)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  seat_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'reserved', 'locked', 'sold')),
  price NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  booked_at TIMESTAMPTZ,
  reserved_at TIMESTAMPTZ,
  reserved_by TEXT,
  booking_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_block_row_seat UNIQUE (event_id, block_id, row_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_seats_event_id ON public.seats(event_id);
CREATE INDEX IF NOT EXISTS idx_seats_event_block ON public.seats(event_id, block_id);
CREATE INDEX IF NOT EXISTS idx_seats_event_status ON public.seats(event_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_booking_id ON public.seats(booking_id);

DROP TRIGGER IF EXISTS trg_seats_updated_at ON public.seats;
CREATE TRIGGER trg_seats_updated_at
  BEFORE UPDATE ON public.seats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Full replica identity for high-fidelity Supabase Realtime seat broadcasts
ALTER TABLE public.seats REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- 7. BOOKINGS (Online Orders & Counter POS Receipts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_number TEXT NOT NULL UNIQUE, -- e.g. NJ26-00001
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_name TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ticket_type_id TEXT REFERENCES public.ticket_types(id) ON DELETE SET NULL,
  ticket_type_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  source TEXT NOT NULL DEFAULT 'Counter' CHECK (source IN ('Online', 'Counter')),
  counter_name TEXT,
  payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('UPI', 'Cash', 'Card', 'Net Banking', 'Wallet', 'Other')),
  transaction_id TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Checked-in', 'Refunded', 'Cancelled', 'Used', 'Pending')),
  booking_status TEXT DEFAULT 'Confirmed' CHECK (booking_status IN ('Confirmed', 'Cancelled', 'Pending')),
  assigned_gate TEXT DEFAULT 'Main Gate',
  block TEXT,
  seats JSONB NOT NULL DEFAULT '[]'::jsonb,
  seat_number TEXT,
  seat_count INTEGER DEFAULT 1,
  used_tickets JSONB NOT NULL DEFAULT '[]'::jsonb,
  used_seats JSONB NOT NULL DEFAULT '[]'::jsonb,
  used_count INTEGER NOT NULL DEFAULT 0,
  entered_count INTEGER NOT NULL DEFAULT 0,
  remaining_count INTEGER NOT NULL DEFAULT 1,
  used_at TIMESTAMPTZ,

  -- Financial charge breakdown
  ticket_amount NUMERIC(12, 2),
  base_amount NUMERIC(12, 2),
  convenience_fee NUMERIC(12, 2),
  gst_on_convenience_fee NUMERIC(12, 2),
  platform_charge NUMERIC(12, 2),
  total_fees NUMERIC(12, 2),
  final_customer_amount NUMERIC(12, 2),

  -- Online payment gateway details
  payment_status TEXT DEFAULT 'Successful' CHECK (payment_status IN ('Successful', 'Pending', 'Failed', 'Refunded', 'Cancelled')),
  payment_channel TEXT DEFAULT 'Counter' CHECK (payment_channel IN ('Online', 'Counter')),
  gateway_transaction_id TEXT,
  booking_secret TEXT,
  payment_date TIMESTAMPTZ,
  ticket_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  other_charges NUMERIC(12, 2) DEFAULT 0.00,
  gateway_fee NUMERIC(12, 2) DEFAULT 0.00,
  actual_cost NUMERIC(12, 2) DEFAULT 0.00,
  profit NUMERIC(12, 2) DEFAULT 0.00,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON public.bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_source ON public.bookings(source);

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. TICKETS (Individual per-seat QR code verification documents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets (
  id TEXT PRIMARY KEY, -- e.g. NJ26-00001-1
  ticket_id TEXT NOT NULL,
  booking_id TEXT NOT NULL, -- references bookings.ticket_number
  booking_doc_id TEXT REFERENCES public.bookings(id) ON DELETE CASCADE,
  ticket_index INTEGER NOT NULL DEFAULT 1,
  total_tickets INTEGER NOT NULL DEFAULT 1,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  ticket_type_id TEXT REFERENCES public.ticket_types(id) ON DELETE SET NULL,
  ticket_type_name TEXT NOT NULL,
  seat TEXT,
  seat_index INTEGER,
  seat_count INTEGER,
  block TEXT,
  assigned_gate TEXT DEFAULT 'Main Gate',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  qr_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENTERED', 'CANCELLED', 'PENDING_PAYMENT')),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  scanned_at TIMESTAMPTZ,
  scanned_by TEXT,
  scanner_member_id TEXT,
  scanner_member_name TEXT,
  scan_gate_id TEXT,
  scan_date TEXT,
  scan_time TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_booking_id ON public.tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON public.tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_token ON public.tickets(qr_token);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_phone ON public.tickets(customer_phone);

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON public.tickets;
CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. SCANNER MEMBERS (Gate Staff & Scanner User Accounts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scanner_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scanner_id TEXT NOT NULL UNIQUE, -- e.g. SCN-001
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  mobile TEXT NOT NULL,
  profile_photo TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'deactivated')),
  assigned_gate_id TEXT,
  assigned_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
  address TEXT,
  id_proof TEXT,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  deactivated_at TIMESTAMPTZ,
  deactivated_by TEXT,
  last_scan_at TIMESTAMPTZ,
  total_scans INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scanner_members_scanner_id ON public.scanner_members(scanner_id);
CREATE INDEX IF NOT EXISTS idx_scanner_members_status ON public.scanner_members(approval_status, account_status);
CREATE INDEX IF NOT EXISTS idx_scanner_members_user_id ON public.scanner_members(user_id);

DROP TRIGGER IF EXISTS trg_scanner_members_updated_at ON public.scanner_members;
CREATE TRIGGER trg_scanner_members_updated_at
  BEFORE UPDATE ON public.scanner_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. TICKET ENTRIES (Gate Scan Verification & Turnstile Logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entry_key TEXT UNIQUE, -- e.g. <eventId>__<ticketId> for idempotent successful scan lock
  ticket_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scanner_id TEXT NOT NULL,
  member_id TEXT REFERENCES public.scanner_members(id) ON DELETE SET NULL,
  scanner_name TEXT NOT NULL,
  gate_id TEXT,
  entry_status TEXT NOT NULL CHECK (entry_status IN ('entered', 'rejected')),
  scan_result TEXT NOT NULL CHECK (scan_result IN ('SUCCESS', 'ALREADY_USED', 'INVALID', 'CANCELLED', 'UNPAID', 'WRONG_EVENT', 'SCANNER_DENIED')),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scan_date TEXT,
  scan_time TEXT,
  booking_id TEXT,
  audience_name TEXT,
  persons INTEGER DEFAULT 1,
  ticket_type TEXT,
  booking_source TEXT,
  previous_entry_time TIMESTAMPTZ,
  previous_scanner_id TEXT,
  previous_scanner_name TEXT,
  previous_gate_id TEXT,
  ticket_number TEXT,
  base_ticket_id TEXT,
  seat TEXT,
  seat_index INTEGER,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_entries_event_id ON public.ticket_entries(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_ticket_id ON public.ticket_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_scanned_at ON public.ticket_entries(scanned_at);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_scanner_id ON public.ticket_entries(scanner_id);

-- ----------------------------------------------------------------------------
-- 11. SETTINGS (System, Hardware POS, & Event Form Formats)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY, -- e.g. 'createEventFormat', 'hardware', 'general'
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. AUDIT LOGS (Immutable Administrator & Scanner Action Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  target_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);

-- ----------------------------------------------------------------------------
-- 13. BANNERS (Customer Mobile App Carousel & Promotions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.banners (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banners_active_order ON public.banners(active, display_order);

DROP TRIGGER IF EXISTS trg_banners_updated_at ON public.banners;
CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backward-compatibility view for Customer Project banners with camelCase aliases
CREATE OR REPLACE VIEW public.banners_view WITH (security_invoker = true) AS
  SELECT
    b.*,
    b.image_url AS "imageUrl",
    b.link_url AS "linkUrl",
    b.event_id AS "eventId",
    b.display_order AS "order"
  FROM public.banners b;

-- ----------------------------------------------------------------------------
-- 14. ADMIN USERS (Role mapping for Supabase Auth Administrators)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
