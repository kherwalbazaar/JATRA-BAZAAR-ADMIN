CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  profile_photo TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON public.profiles(mobile);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at DESC);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT false,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_otps_mobile ON public.customer_otps(mobile);
CREATE INDEX IF NOT EXISTS idx_customer_otps_active ON public.customer_otps(mobile, consumed, expires_at);

CREATE TABLE IF NOT EXISTS public.sms_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile TEXT NOT NULL,
  ist_date DATE NOT NULL,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sms_daily_mobile_date UNIQUE (mobile, ist_date)
);

CREATE INDEX IF NOT EXISTS idx_sms_daily_lookup ON public.sms_daily_logs(mobile, ist_date);

DROP TRIGGER IF EXISTS trg_sms_daily_updated_at ON public.sms_daily_logs;
CREATE TRIGGER trg_sms_daily_updated_at
  BEFORE UPDATE ON public.sms_daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.check_and_increment_daily_sms(
  p_mobile TEXT,
  p_ist_date DATE,
  p_max_limit INT DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
  v_sent INT := 0;
  v_failed INT := 0;
BEGIN
  INSERT INTO public.sms_daily_logs (mobile, ist_date, sent_count, failed_count)
  VALUES (p_mobile, p_ist_date, 0, 0)
  ON CONFLICT (mobile, ist_date) DO NOTHING;

  SELECT sent_count, failed_count INTO v_sent, v_failed
  FROM public.sms_daily_logs
  WHERE mobile = p_mobile AND ist_date = p_ist_date
  FOR UPDATE;

  IF v_sent >= p_max_limit THEN
    RETURN jsonb_build_object('allowed', false, 'sent_count', v_sent, 'remaining', 0, 'max_limit', p_max_limit);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'sent_count', v_sent, 'remaining', p_max_limit - v_sent, 'max_limit', p_max_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_sms_delivery_result(
  p_mobile TEXT,
  p_ist_date DATE,
  p_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  IF p_success THEN
    INSERT INTO public.sms_daily_logs (mobile, ist_date, sent_count, failed_count)
    VALUES (p_mobile, p_ist_date, 1, 0)
    ON CONFLICT (mobile, ist_date)
    DO UPDATE SET sent_count = public.sms_daily_logs.sent_count + 1, updated_at = now();
  ELSE
    INSERT INTO public.sms_daily_logs (mobile, ist_date, sent_count, failed_count)
    VALUES (p_mobile, p_ist_date, 0, 1)
    ON CONFLICT (mobile, ist_date)
    DO UPDATE SET failed_count = public.sms_daily_logs.failed_count + 1, updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "otps_all" ON public.customer_otps;
DROP POLICY IF EXISTS "sms_all" ON public.sms_daily_logs;
DROP POLICY IF EXISTS "Allow anon and authenticated select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon and authenticated insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon and authenticated update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public access to customer_otps" ON public.customer_otps;
DROP POLICY IF EXISTS "Public access to sms_daily_logs" ON public.sms_daily_logs;
DROP POLICY IF EXISTS "Server access to customer_otps" ON public.customer_otps;
DROP POLICY IF EXISTS "Server access to sms_daily_logs" ON public.sms_daily_logs;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "profiles_all" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "otps_all" ON public.customer_otps FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "sms_all" ON public.sms_daily_logs FOR ALL TO public USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
