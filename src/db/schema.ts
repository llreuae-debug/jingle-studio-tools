import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("user"), // user | admin
  disabled: boolean("disabled").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("accounts_provider_account_idx").on(
      table.provider,
      table.providerAccountId
    ),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("verification_tokens_idx").on(table.identifier, table.token)]
);

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | admin | member
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("memberships_ws_user_idx").on(table.workspaceId, table.userId)]
);

export const workspaceInvites = pgTable("workspace_invites", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signingProfiles = pgTable("signing_profiles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  website: text("website"),
  defaultTrainingPreference: boolean("default_training_preference").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signJobs = pgTable(
  "sign_jobs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"), // queued | running | partial_failure | done | failed
    fileCount: integer("file_count").notNull(),
    creditsReserved: integer("credits_reserved").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    creatorName: text("creator_name").notNull(),
    creatorWebsite: text("creator_website"),
    doNotTrain: boolean("do_not_train").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("sign_jobs_ws_idem_idx").on(table.workspaceId, table.idempotencyKey),
  ]
);

export const signJobItems = pgTable("sign_job_items", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => signJobs.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  inputKey: text("input_key"),
  inputSha256: text("input_sha256").notNull(),
  outputKey: text("output_key"),
  outputSha256: text("output_sha256"),
  status: text("status").notNull().default("queued"), // queued | running | done | failed | expired
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disclosures = pgTable("disclosures", {
  id: text("id").primaryKey(),
  jobItemId: text("job_item_id")
    .notNull()
    .unique()
    .references(() => signJobItems.id, { onDelete: "cascade" }),
  aiUse: text("ai_use").notNull(), // full_ai | original_edited_ai | composite_ai | human_edits_ai | no_ai
  digitalSourceType: text("digital_source_type").notNull(),
  modelType: text("model_type"),
  modelName: text("model_name"),
  declaredBy: text("declared_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchases = pgTable("purchases", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // hosted | manual_bank
  providerRef: text("provider_ref").notNull().unique(),
  packId: text("pack_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  credits: integer("credits").notNull(),
  status: text("status").notNull().default("pending"), // pending | paid | failed | rejected
  bankReference: text("bank_reference"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditLedgerEntries = pgTable(
  "credit_ledger_entries",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(), // purchase | job_reserve | item_refund | welcome_bonus | manual_adjustment
    jobId: text("job_id"),
    purchaseId: text("purchase_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const publicCredentials = pgTable("public_credentials", {
  id: text("id").primaryKey(),
  jobItemId: text("job_item_id")
    .notNull()
    .unique()
    .references(() => signJobItems.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("live"), // live | revoked
  title: text("title").notNull(),
  thumbnailDataUrl: text("thumbnail_data_url"),
  signer: text("signer").notNull(),
  creatorName: text("creator_name").notNull(),
  disclosureSummary: text("disclosure_summary").notNull(),
  signingTimeIso: text("signing_time_iso").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const abuseReports = pgTable("abuse_reports", {
  id: text("id").primaryKey(),
  publicCredentialId: text("public_credential_id")
    .notNull()
    .references(() => publicCredentials.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  reporterEmail: text("reporter_email"),
  status: text("status").notNull().default("open"), // open | reviewed | dismissed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  label: text("label").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trustListSnapshots = pgTable("trust_list_snapshots", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  sha256: text("sha256").notNull(),
  pemBundle: text("pem_bundle").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
});

export const mediaProcessingRecords = pgTable("media_processing_records", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  ownerTokenHash: text("owner_token_hash"),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  mediaKind: text("media_kind").notNull(), // image | video
  fileSizeBytes: integer("file_size_bytes").notNull(),
  cleanedSizeBytes: integer("cleaned_size_bytes"),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  codec: text("codec"),
  frameRate: text("frame_rate"),
  status: text("status").notNull().default("queued"), // queued | processing | done | failed | expired
  c2paStatus: text("c2pa_status").notNull().default("not_detected"), // present | not_detected | unable_to_verify
  c2paResultStatus: text("c2pa_result_status").notNull().default("not_present"), // preserved | not_present | unable_to_preserve
  c2paIssuer: text("c2pa_issuer"),
  c2paCredentialStatus: text("c2pa_credential_status"),
  synthIdStatus: text("synthid_status").notNull().default("verification_unavailable"), // verified_no_signal | signal_detected | verification_unavailable | inconclusive
  synthIdProvider: text("synthid_provider"),
  synthIdDetail: text("synthid_detail"),
  personalMetadataStatus: text("personal_metadata_status").notNull().default("not_available"), // removed | preserved | not_available
  removedFields: jsonb("removed_fields").$type<string[]>(),
  beforeMetadata: jsonb("before_metadata"),
  afterMetadata: jsonb("after_metadata"),
  cleaningOptions: jsonb("cleaning_options"),
  processingTimeMs: integer("processing_time_ms"),
  processingStages: jsonb("processing_stages"),
  originalKey: text("original_key"),
  cleanedKey: text("cleaned_key"),
  thumbnailDataUrl: text("thumbnail_data_url"),
  inputSha256: text("input_sha256"),
  outputSha256: text("output_sha256"),
  errorMessage: text("error_message"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const mediaDownloadRecords = pgTable("media_download_records", {
  id: text("id").primaryKey(),
  recordId: text("record_id")
    .notNull()
    .references(() => mediaProcessingRecords.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  ownerScope: text("owner_scope").notNull(),
  kind: text("kind").notNull(), // cleaned | original
  fileName: text("file_name").notNull(),
  bytesSent: integer("bytes_sent").notNull(),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pricingPlans = pgTable("pricing_plans", {
  id: text("id").primaryKey(), // free | pro | business
  name: text("name").notNull(),
  monthlyPriceCents: integer("monthly_price_cents").notNull().default(0),
  dailyLimit: integer("daily_limit").notNull().default(20),
  maxImageMb: integer("max_image_mb").notNull().default(25),
  maxVideoMb: integer("max_video_mb").notNull().default(100),
  includedCredits: integer("included_credits").notNull().default(10),
  features: jsonb("features").$type<string[]>().notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  planId: text("plan_id")
    .notNull()
    .references(() => pricingPlans.id),
  status: text("status").notNull().default("active"), // active | cancelled
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const systemLogs = pgTable("system_logs", {
  id: text("id").primaryKey(),
  level: text("level").notNull().default("info"), // info | warn | error
  event: text("event").notNull(),
  userId: text("user_id"),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
