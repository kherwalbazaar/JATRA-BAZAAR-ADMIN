-- ============================================================
-- Migration 008: Customer Mobile Number Storage & Sync
-- JATRA BAZAAR — Customer Profiles & Supabase Auth Sync
-- ============================================================

-- 1. Ensure mobile column exists on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile TEXT;

-- 2. Add phone column as a mirrored column to support both naming conventions seamlessly
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Populate phone from existing mobile numbers
UPDATE public.profiles
SET phone = mobile
WHERE (phone IS NULL OR phone = '') AND (mobile IS NOT NULL AND mobile != '');

-- 4. Create trigger to keep mobile and phone columns 100% synchronized
CREATE OR REPLACE FUNCTION public.sync_profile_mobile_and_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mobile IS NOT NULL AND NEW.mobile != '' AND (NEW.phone IS NULL OR NEW.phone = '') THEN
    NEW.phone = NEW.mobile;
  ELSIF NEW.phone IS NOT NULL AND NEW.phone != '' AND (NEW.mobile IS NULL OR NEW.mobile = '') THEN
    NEW.mobile = NEW.phone;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profile_mobile_and_phone ON public.profiles;
CREATE TRIGGER trg_sync_profile_mobile_and_phone
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_mobile_and_phone();

-- 5. Indexes for fast lookup by mobile and phone
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON public.profiles(mobile);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
