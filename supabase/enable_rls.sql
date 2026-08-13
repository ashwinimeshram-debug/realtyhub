-- ============================================================
-- Realty Hub — Enable RLS + Lock Down anon / authenticated
-- ------------------------------------------------------------
-- Problem (Supabase Security Advisor):
--   rls_disabled_in_public, sensitive_columns_exposed
--   All tables had RLS disabled and full SELECT/INSERT/UPDATE/DELETE
--   granted to the public anon/authenticated roles, so anyone with
--   the anon key could read/edit/delete everything (incl. admins).
--
-- Fix: enable RLS on every public table and revoke all table access
-- from anon/authenticated. The app never uses the PostgREST anon
-- key — the Flask backend connects as the table owner (`postgres`)
-- and uses `service_role` for storage, both of which bypass RLS,
-- so this does not affect the application.
--
-- Safe to re-run (idempotent). Run in Supabase SQL Editor.
-- ============================================================

-- 1) Enable RLS on every user table owned by the current role.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 2) Revoke all existing table/sequence privileges from public roles.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3) Ensure newly created tables/sequences (e.g. future db.create_all()
--    columns/tables) do not inherit anon/authenticated access.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
