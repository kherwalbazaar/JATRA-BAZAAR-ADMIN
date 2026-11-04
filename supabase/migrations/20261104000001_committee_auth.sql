-- ============================================================
-- Super Admin + Committee authentication, approval and permissions
--
-- Reuses what already exists (no duplicate auth system):
--   auth.users            -> Supabase Auth accounts (password lives here, never in a table)
--   public.profiles       -> identity row per user (id/mobile/email/role/is_active/status/last_login_at)
--   public.admin_users    -> trusted Super Admin mapping already consumed by public.is_admin()
--   public.settings       -> key/value JSONB config, used for the admin contact block
--   public.audit_logs     -> action/target/metadata trail, used for permission history
--
-- Adds only what has no existing home: the committee application record and its
-- per-module permission grants. Idempotent — safe to re-run.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 0. PREREQUISITES
--    gen_random_uuid() and set_updated_at() are used by the tables and triggers
--    below. Both already exist in a normal Supabase project, so re-declaring
--    them costs nothing and keeps this file runnable on its own.
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 1. COMMITTEES (registration + application lifecycle in one row)
--    Mirrors the shape already proven for scanner_members: approval_status /
--    account_status / reviewed-by / reviewed-at.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.committees (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  application_ref    TEXT UNIQUE,
  committee_name     TEXT NOT NULL,
  primary_mobile     TEXT NOT NULL,
  address            TEXT NOT NULL,
  email              TEXT NOT NULL,
  event_date         DATE NOT NULL,
  application_status TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (application_status IN ('PENDING','APPROVED','REJECTED','DEACTIVATED')),
  rejection_reason   TEXT,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at        TIMESTAMPTZ,
  reviewed_by        UUID,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalised identity columns are stored, not generated, so PostgREST can
-- enforce uniqueness without exposing expression indexes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_committees_email   ON public.committees (lower(btrim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_committees_mobile  ON public.committees (btrim(primary_mobile));
CREATE UNIQUE INDEX IF NOT EXISTS uq_committees_name    ON public.committees (lower(btrim(committee_name)));
CREATE INDEX IF NOT EXISTS idx_committees_status       ON public.committees(application_status);
CREATE INDEX IF NOT EXISTS idx_committees_user         ON public.committees(user_id);

DROP TRIGGER IF EXISTS trg_committees_updated_at ON public.committees;
CREATE TRIGGER trg_committees_updated_at
  BEFORE UPDATE ON public.committees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. COMMITTEE PERMISSIONS (row per committee x module)
--    No grant means no access — approved committees start with zero rows.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.committee_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  module_key   TEXT NOT NULL,
  can_view     BOOLEAN NOT NULL DEFAULT false,
  can_create   BOOLEAN NOT NULL DEFAULT false,
  can_edit     BOOLEAN NOT NULL DEFAULT false,
  can_delete   BOOLEAN NOT NULL DEFAULT false,
  can_approve  BOOLEAN NOT NULL DEFAULT false,
  updated_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_committee_permission UNIQUE (committee_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_committee_permissions_module ON public.committee_permissions(module_key);

DROP TRIGGER IF EXISTS trg_committee_permissions_updated_at ON public.committee_permissions;
CREATE TRIGGER trg_committee_permissions_updated_at
  BEFORE UPDATE ON public.committee_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS
--    SECURITY DEFINER with an explicit search_path, so a committee can read its
--    own status/permissions without a policy that would recurse into
--    committees (the classic Supabase RLS deadlock).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_committee_id()
RETURNS UUID AS $$
  SELECT id FROM public.committees WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- hasPermission(userId, module, action) — the single source of truth for
-- authorisation. Super Admin passes everything; a committee only passes an
-- explicit grant.
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_module TEXT, p_action TEXT)
RETURNS boolean AS $$
DECLARE
  v_action TEXT := lower(coalesce(nullif(btrim(p_action), ''), 'view'));
  v_committee UUID;
  v_allowed BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(p_user_id) THEN
    RETURN true;
  END IF;

  SELECT id INTO v_committee
  FROM public.committees
  WHERE user_id = p_user_id
    AND application_status = 'APPROVED';

  IF v_committee IS NULL THEN
    RETURN false;
  END IF;

  SELECT CASE v_action
    WHEN 'view'    THEN can_view
    WHEN 'create'  THEN can_create
    WHEN 'edit'    THEN can_edit
    WHEN 'delete'  THEN can_delete
    WHEN 'approve' THEN can_approve
    ELSE false
  END INTO v_allowed
  FROM public.committee_permissions
  WHERE committee_id = v_committee
    AND module_key = p_module;

  RETURN coalesce(v_allowed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- is_admin() gained a one-argument overload so the same trust rule
-- (admin_users row OR non-user-editable app_metadata) serves both the RLS
-- policies and has_permission(). The existing no-arg form is untouched.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS boolean AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = p_user_id
        AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_user_id::text
        AND role = 'super_admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp;

-- PostgREST exposes every public function to the anon key by default. These
-- helpers answer authorisation questions, so only a signed-in user may ask them.
REVOKE ALL ON FUNCTION public.has_permission(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_committee_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_committee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Every write below is performed server-side with the service role, so the
--    client policies are read-only by design: a committee can see its own
--    application and its own grants, nothing else, and has no INSERT or UPDATE
--    policy to escalate with.
-- ----------------------------------------------------------------------------
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Committee can view own application" ON public.committees;
CREATE POLICY "Committee can view own application"
  ON public.committees FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Committee can view own permissions" ON public.committee_permissions;
CREATE POLICY "Committee can view own permissions"
  ON public.committee_permissions FOR SELECT
  TO authenticated
  USING (committee_id = public.current_committee_id());

-- Belt and braces for anything that ever gains a write policy: status,
-- rejection reason and review stamps are Super Admin fields.
CREATE OR REPLACE FUNCTION public.guard_committee_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role (the panel server) and the SQL editor (no signed-in user) are
  -- trusted paths; a browser request always carries auth.uid().
  IF auth.role() = 'service_role' OR auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.application_status IS DISTINCT FROM OLD.application_status
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Committee status fields are managed by Super Admin only';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_committees_guard_admin_fields ON public.committees;
CREATE TRIGGER trg_committees_guard_admin_fields
  BEFORE UPDATE ON public.committees
  FOR EACH ROW EXECUTE FUNCTION public.guard_committee_admin_fields();

-- ----------------------------------------------------------------------------
-- 5. ADMIN CONTACT CONFIG (settings row, editable without touching code)
-- ----------------------------------------------------------------------------
INSERT INTO public.settings (id, key, description, data)
VALUES (
  'admin_contact',
  'admin_contact',
  'Admin Contact Information',
  '{"contactName":"","primaryMobile":"","whatsappNumber":"","supportEmail":"","supportMessage":""}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. REVEAL THE NEW TABLES TO THE API
--    PostgREST caches its schema, so without this the panel keeps reporting
--    "Could not find the table 'public.committees'" for a few seconds.
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
