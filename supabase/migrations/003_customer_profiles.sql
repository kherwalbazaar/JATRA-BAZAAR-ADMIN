-- ============================================================
-- Migration 003: Customer Profiles Table & Row Level Security
-- JATRA BAZAAR — Customer Profile Creation & Management
-- Safe & Idempotent: Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Helper function for automated updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

-- 2. Create public.profiles table
-- Note: id is TEXT to seamlessly accept both Supabase Auth UUIDs and client customer IDs
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  profile_photo TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for rapid lookups by mobile & role
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON public.profiles(mobile);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. Automatic updated_at trigger
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Clean existing policies to prevent conflicts
DROP POLICY IF EXISTS "Public access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all customer profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon and authenticated select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon and authenticated insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon and authenticated update profiles" ON public.profiles;

-- 7. Comprehensive RLS Policies for Mobile/Web Audience Portal
-- Allow reading profiles
CREATE POLICY "Allow anon and authenticated select profiles"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);

-- Allow creating new customer profile
CREATE POLICY "Allow anon and authenticated insert profiles"
  ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow updating profile
CREATE POLICY "Allow anon and authenticated update profiles"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Full unrestricted access for service_role backend operations
CREATE POLICY "Service role full access on profiles"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8. Instantly reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
