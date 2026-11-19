-- Idempotent Row Level Security (RLS) policy script for Supabase / PostgreSQL deployments.
-- Server-side Drizzle ORM connects with service credentials while also enforcing
-- workspaceId / userId / ownerTokenHash checks in every API handler and Server Component.

ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media_processing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media_download_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sign_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS credit_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users
  FOR SELECT
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS workspaces_member_select ON workspaces;
CREATE POLICY workspaces_member_select ON workspaces
  FOR SELECT
  USING (
    auth.uid()::text = owner_id
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS media_records_owner_all ON media_processing_records;
CREATE POLICY media_records_owner_all ON media_processing_records
  FOR ALL
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.workspace_id = media_processing_records.workspace_id AND m.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.workspace_id = media_processing_records.workspace_id AND m.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS media_downloads_owner_all ON media_download_records;
CREATE POLICY media_downloads_owner_all ON media_download_records
  FOR ALL
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.workspace_id = media_download_records.workspace_id AND m.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS sign_jobs_member_select ON sign_jobs;
CREATE POLICY sign_jobs_member_select ON sign_jobs
  FOR SELECT
  USING (
    auth.uid()::text = created_by
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.workspace_id = sign_jobs.workspace_id AND m.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS credit_ledger_member_select ON credit_ledger_entries;
CREATE POLICY credit_ledger_member_select ON credit_ledger_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.workspace_id = credit_ledger_entries.workspace_id AND m.user_id = auth.uid()::text
    )
  );
