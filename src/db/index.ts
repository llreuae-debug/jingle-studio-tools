import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolvePersistentDataDir } from "@/lib/data-dir";
import * as schema from "./schema";

export type AppDb = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let dbPromise: Promise<AppDb> | null = null;
let pgliteClient: PGlite | null = null;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  email_verified TIMESTAMPTZ,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_account_idx ON accounts(provider, provider_account_id);

CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS verification_tokens_idx ON verification_tokens(identifier, token);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_ws_user_idx ON memberships(workspace_id, user_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signing_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  website TEXT,
  default_training_preference BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sign_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  file_count INTEGER NOT NULL,
  credits_reserved INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  creator_website TEXT,
  do_not_train BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS sign_jobs_ws_idem_idx ON sign_jobs(workspace_id, idempotency_key);

CREATE TABLE IF NOT EXISTS sign_job_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES sign_jobs(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  input_key TEXT,
  input_sha256 TEXT NOT NULL,
  output_key TEXT,
  output_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disclosures (
  id TEXT PRIMARY KEY,
  job_item_id TEXT NOT NULL UNIQUE REFERENCES sign_job_items(id) ON DELETE CASCADE,
  ai_use TEXT NOT NULL,
  digital_source_type TEXT NOT NULL,
  model_type TEXT,
  model_name TEXT,
  declared_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_ref TEXT NOT NULL UNIQUE,
  pack_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bank_reference TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  job_id TEXT,
  purchase_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_credentials (
  id TEXT PRIMARY KEY,
  job_item_id TEXT NOT NULL UNIQUE REFERENCES sign_job_items(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'live',
  title TEXT NOT NULL,
  thumbnail_data_url TEXT,
  signer TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  disclosure_summary TEXT NOT NULL,
  signing_time_iso TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS abuse_reports (
  id TEXT PRIMARY KEY,
  public_credential_id TEXT NOT NULL REFERENCES public_credentials(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  reporter_email TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trust_list_snapshots (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  pem_bundle TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS media_processing_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  owner_token_hash TEXT,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  media_kind TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  cleaned_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  codec TEXT,
  frame_rate TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  c2pa_status TEXT NOT NULL DEFAULT 'not_detected',
  c2pa_result_status TEXT NOT NULL DEFAULT 'not_present',
  c2pa_issuer TEXT,
  c2pa_credential_status TEXT,
  synthid_status TEXT NOT NULL DEFAULT 'verification_unavailable',
  synthid_provider TEXT,
  synthid_detail TEXT,
  personal_metadata_status TEXT NOT NULL DEFAULT 'not_available',
  removed_fields JSONB,
  before_metadata JSONB,
  after_metadata JSONB,
  cleaning_options JSONB,
  processing_time_ms INTEGER,
  processing_stages JSONB,
  original_key TEXT,
  cleaned_key TEXT,
  thumbnail_data_url TEXT,
  input_sha256 TEXT,
  output_sha256 TEXT,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE media_processing_records ADD COLUMN IF NOT EXISTS c2pa_credential_status TEXT;
ALTER TABLE media_processing_records ADD COLUMN IF NOT EXISTS synthid_provider TEXT;
ALTER TABLE media_processing_records ADD COLUMN IF NOT EXISTS synthid_detail TEXT;
ALTER TABLE media_processing_records ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE media_processing_records ADD COLUMN IF NOT EXISTS processing_stages JSONB;

CREATE TABLE IF NOT EXISTS media_download_records (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES media_processing_records(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  owner_scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  bytes_sent INTEGER NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 20,
  max_image_mb INTEGER NOT NULL DEFAULT 25,
  max_video_mb INTEGER NOT NULL DEFAULT 100,
  included_credits INTEGER NOT NULL DEFAULT 10,
  features JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pricing_plans (id, name, monthly_price_cents, daily_limit, max_image_mb, max_video_mb, included_credits, features, active)
VALUES
  ('free', 'Free', 0, 20, 25, 100, 10, '["Basic metadata & C2PA inspection","Lossless personal metadata cleaning","Up to 25 MB images & 100 MB videos","20 daily checks/cleanings"]'::jsonb, TRUE),
  ('pro', 'Pro', 1900, 250, 50, 250, 100, '["Extended metadata & provenance reports","7-day processing history & clean downloads","Up to 50 MB images & 250 MB videos","250 daily checks/cleanings & priority batch signing"]'::jsonb, TRUE),
  ('business', 'Business', 4900, 2000, 100, 500, 500, '["REST API & MCP server access","Team workspaces & shared roles","Up to 100 MB images & 500 MB videos","2,000 daily checks/cleanings"]'::jsonb, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES pricing_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  event TEXT NOT NULL,
  user_id TEXT,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function initDb(): Promise<AppDb> {
  const envUrl = process.env.DATABASE_URL?.trim();

  if (envUrl && (envUrl.startsWith("postgres://") || envUrl.startsWith("postgresql://"))) {
    const pool = new Pool({ connectionString: envUrl });
    await pool.query(INIT_SQL);
    return drizzlePg(pool, { schema });
  }

  let dataDir: string | undefined;
  if (!envUrl) {
    dataDir = path.join(resolvePersistentDataDir(), ".pglite");
  } else {
    const raw = envUrl.startsWith("pglite://")
      ? envUrl.slice("pglite://".length) || ".pglite"
      : envUrl;
    if (raw === ":memory:") {
      dataDir = undefined;
    } else if (path.isAbsolute(raw)) {
      dataDir = raw;
    } else {
      dataDir = path.join(resolvePersistentDataDir(), raw);
    }
  }

  if (dataDir) {
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  }

  pgliteClient = new PGlite(dataDir);
  await pgliteClient.exec(INIT_SQL);
  return drizzlePglite(pgliteClient, { schema });
}

export async function getDb(): Promise<AppDb> {
  if (!dbPromise) {
    dbPromise = initDb();
  }
  return dbPromise;
}

export function resetDbForTests() {
  dbPromise = null;
  pgliteClient = null;
}

export { schema };
