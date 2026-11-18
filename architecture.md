# Architecture Specification: Content Credentials Checker & Batch Signer

**Status:** Draft for MVP build (`M` size)  
**Source:** [recon.md](file:///Users/dilnawaz/SynthID%20Remover/recon.md), [features.csv](file:///Users/dilnawaz/SynthID%20Remover/features.csv)  
**Date:** 2026-11-19

---

## 1. Architectural Principles & Guardrails

The system is split into two distinct trust boundaries:

1. **Client-Side Verification (Free, No Account, On-Device):**  
   Inspection of local files (`/verify`) runs entirely in the browser via WebAssembly (`@contentauth/c2pa-web`). Files never leave the user's device during verification.
2. **Server-Side Batch Signing (Authenticated, Credit-Billed):**  
   Signing requires private keys and native C2PA bindings (`@contentauth/c2pa-node`). Files are uploaded to ephemeral object storage, processed by an isolated worker, re-validated, and the raw inputs are deleted immediately after signing.

### Hard Guardrails Enforced in Code

| Guardrail | Enforcement Point | Implementation |
| --- | --- | --- |
| **G1 (No Stripping)** | API & Worker | No endpoints or flags exist to strip, omit, or flatten C2PA/SynthID metadata. |
| **G2 (Preserve Chain)** | Signing Worker | Before signing, the worker reads the input `ManifestStore`. If an active manifest exists, the input file is attached as a `parentOf` ingredient (`c2pa.opened` → `c2pa.edited`/`enhanced`). |
| **G3 (Block Invalid)** | Pre-flight & Worker | If `validation_status` on an existing manifest contains any error, signing is rejected with `ERR_INVALID_EXISTING_CREDENTIALS` and the validation error details are returned. |
| **G4 (AI Conflict)** | S16 UI & Worker | If any valid ingredient in the manifest chain has an AI `digitalSourceType` (`trainedAlgorithmicMedia`, `compositeWithTrainedAlgorithmicMedia`, `compositeSynthetic`), the `"Made by people, no generative AI"` option is disabled in UI and rejected by the API (`ERR_DISCLOSURE_CONFLICT`). |
| **G5 (No AI Detection)** | UI & Public Proof | Copy never states a file is "real", "human-made", or "not AI". Missing credentials always render `"No Content Credentials found"`. |
| **G6 (Self-Declared)** | S02, S16, S20 | User-entered author names, websites, and AI disclosures are explicitly badged `Self-declared` and stored in `CreativeWork` / `c2pa.ai-disclosure` assertions. |
| **G7 (Honest Claims)** | S20 & Marketing | Public proof pages include a plain-language caveat explaining what C2PA proves (provenance from the point of signing) and what it does not prove. |

---

## 2. Recommended Tech Stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| **Frontend & SSR** | **Next.js (App Router) + TypeScript + Tailwind CSS** | `/verify` runs as a pure client-side WASM route; `/p/:slug` (S20 Public Proof) gets SSR and OpenGraph metadata for sharing. |
| **Browser C2PA SDK** | **`@contentauth/c2pa-web`** | Official WASM-based reader for JPEG, PNG, WebP (and Phase 2 formats: HEIC, AVIF, TIFF, DNG, SVG). |
| **Backend API & Worker** | **Node.js 22+ (patched) + TypeScript (Fastify or Hono)** | `c2pa-node` requires a patched Node 22+ release. Separating the API/Worker from serverless edge runtimes avoids timeout and native-binding issues on 50-file batches. |
| **Server C2PA SDK** | **`@contentauth/c2pa-node`** | Official native bindings for reading, validating, building manifests, and signing. |
| **Database** | **PostgreSQL + Drizzle ORM** | ACID transactions for atomic credit reservations, idempotent ledger entries, and relational workspace/job state. |
| **Job Queue** | **`pg-boss` (Postgres-backed queue)** | Eliminates Redis operational overhead for MVP while providing reliable retries, concurrency limits, and job state tracking. |
| **Object Storage** | **Cloudflare R2 or AWS S3** | Presigned direct-to-bucket uploads (bypasses API memory limits for 50-file batches) + lifecycle rules for automatic cleanup. |
| **Auth** | **Better Auth / Auth.js (Email + OAuth)** | Supports email magic links/password + OAuth for `/login` (S14) and workspace invites (F13). |
| **Billing** | **Merchant of Record (Paddle / Lemon Squeezy / Polar)** | Abstracted behind a `BillingProvider` interface. MoR providers handle global cards/VAT and support payouts to Pakistan-based businesses (unlike Stripe). |

---

## 3. System Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             Browser (Next.js)                           │
│                                                                         │
│  /verify (S01-S04)                     /app/* (S14-S21)                 │
│  ┌──────────────────────────┐          ┌──────────────────────────────┐ │
│  │ @contentauth/c2pa-web    │          │ Batch Upload (Presigned PUT) │ │
│  │ (WASM, files stay local) │          │ Disclosure UI (G4 guarded)   │ │
│  └────────────┬─────────────┘          └──────────────┬───────────────┘ │
└───────────────┼───────────────────────────────────────┼─────────────────┘
                │ Fetch Trust List JSON                 │ REST / SSE / Poll
                ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       API Server (Node 22+ / Fastify)                   │
│  • Auth & Workspace RBAC (owner | admin | member)                       │
│  • Presigned Upload URLs & Job Creation (Idempotent Credit Reserve)     │
│  • Trust List Endpoint (serves active TrustListSnapshot)                │
│  • Billing Webhooks (idempotent Purchase -> CreditLedgerEntry)          │
│  • Public Proof API (/p/:slug)                                          │
└───────────────┬───────────────────────────────────────┬─────────────────┘
                │                                       │ Enqueue (pg-boss)
                ▼                                       ▼
┌──────────────────────────────┐         ┌────────────────────────────────┐
│     PostgreSQL + pg-boss     │         │    Signing Worker (Node 22+)   │
│  • 12 Domain Tables          │◄───────►│  • Stream input from R2/S3     │
│  • Append-only Credit Ledger │         │  • Pre-flight validate (G3/G4) │
│  • Job & Item State          │         │  • Sign via c2pa-node (G2)     │
└──────────────────────────────┘         │  • Post-sign validate          │
                                         │  • Delete raw input immediately│
                                         │  • Upload signed output (TTL)  │
                                         └───────────────┬────────────────┘
                                                         │
                                                         ▼
                                         ┌────────────────────────────────┐
                                         │     Object Storage (R2/S3)     │
                                         │  • /inputs/* (deleted on done) │
                                         │  • /outputs/* (expires_at TTL) │
                                         └────────────────────────────────┘
```

---

## 4. Database Schema & Credit Ledger Design

Maps directly to the 12 stored entities in `recon.md`:

- **Tenancy & Auth:** `users`, `workspaces`, `memberships` (`owner | admin | member`), `signing_profiles` (`display_name`, `website`, `default_training_preference`).
- **Signing Jobs:**
  - `sign_jobs`: `id`, `workspace_id`, `created_by`, `status` (`queued | running | partial_failure | done | failed | expired`), `file_count`, `credits_reserved`, `idempotency_key` (unique per workspace).
  - `sign_job_items`: `id`, `job_id`, `original_name`, `input_key`, `input_sha256`, `output_key`, `output_sha256`, `status` (`queued | processing | done | failed`), `error_code`, `expires_at`.
  - `disclosures`: `id`, `job_item_id` (1-1), `ai_use`, `digital_source_type`, `model_type`, `model_name`, `declared_by`.
- **Sharing & API:**
  - `public_credentials`: `id`, `job_item_id` (0-1), `slug` (unique), `status` (`live | revoked`), `created_at`.
  - `api_keys`: `id`, `workspace_id`, `key_hash`, `label`, `last_used_at`, `revoked_at`.
- **Trust & Billing:**
  - `trust_list_snapshots`: `id`, `source_url`, `sha256`, `pem_bundle`, `fetched_at`, `active`.
  - `purchases`: `id`, `workspace_id`, `provider`, `provider_ref` (unique), `amount_cents`, `currency`, `credits`, `status`.
  - `credit_ledger_entries`: `id`, `workspace_id`, `delta` (integer, positive or negative), `reason` (`purchase | job_reserve | item_refund | manual_adjustment`), `job_id`, `purchase_id`, `created_at`.

### Idempotency Rules

1. **Job Submission (`POST /api/jobs`):** Requires an `Idempotency-Key` header (UUID generated per submit attempt on the client). Inside a single Postgres transaction:
   - Check `sign_jobs` for `(workspace_id, idempotency_key)`. If found, return the existing job.
   - Sum `credit_ledger_entries.delta` for `workspace_id` (`SELECT SUM(delta) ... FOR UPDATE` on workspace row to prevent race conditions).
   - If `balance < file_count`, abort with `402 Payment Required`.
   - Insert `sign_jobs`, `sign_job_items`, `disclosures`, and a negative `credit_ledger_entries` row (`delta = -file_count`, `reason = 'job_reserve'`).
2. **Item Failure Refund:** When all items in a job finish, any item with `status = 'failed'` triggers an idempotent refund entry (`delta = +failed_count`, `reason = 'item_refund'`).
3. **Billing Webhook:** Unique constraint on `purchases.provider_ref` ensures duplicate webhooks never double-credit a workspace.

---

## 5. Key Flows & Technical Details

### A. Client-Side Verify (`F01`, `F02`, `F03`, `F04`)
- **Local File (`F01`):** User drops file into S01 → `@contentauth/c2pa-web` reads the manifest store in-browser using the latest `TrustListSnapshot` fetched from `/api/trust-list/active`.
- **Verify by URL (`F02`):** `/verify?source=<ASSET_URL>` attempts a browser `fetch()` with CORS. If the host blocks CORS or requires auth, S03 displays a clear explanation and prompts the user to download and drop the file locally (no server-side proxy in v1 to avoid SSRF and bandwidth abuse).
- **Ingredient Tree (`F04`):** S02 renders the active manifest and recursive `ingredients[]` in the centre panel; clicking any node opens S04 with that ingredient's manifest or a `"No credentials on this source file"` state.

### B. Batch Signing Pipeline (`F10`)
1. **Upload:** Client requests presigned `PUT` URLs (`POST /api/uploads/presign`) for up to 50 JPG/PNG files, hashing each file (`SHA-256`) in the browser.
2. **Optional Client Pre-check:** Client can run `c2pa-web` on selected files to immediately warn the user about G3 (corrupt credentials) or G4 (AI ingredient present → disable "No AI" option in S16) before upload.
3. **Submit Job:** Client submits `POST /api/jobs` with file keys, `SigningProfile` / attribution details, `Disclosure` answers, and `Idempotency-Key`.
4. **Worker Execution (per `SignJobItem`):**
   - Download input from R2/S3 to a temporary encrypted/ephemeral directory.
   - Read & validate existing `ManifestStore` via `c2pa-node`.
   - Enforce **G3** (reject if `validation_status` has errors) and **G4** (reject if AI ingredient conflicts with `humanEdits` disclosure).
   - Build new manifest:
     - **G2:** If valid existing manifest exists, add input as `parentOf` ingredient.
     - Add `c2pa.actions` with mapped `digitalSourceType` from `recon.md`.
     - If AI declared, add `c2pa.ai-disclosure` (`modelType`, `modelName`, `modelIdentifier`) linked via `relatedAssertions`.
     - Add `CreativeWork` (self-declared author/website) and optional `c2pa.training-mining` (`do-not-train`).
   - Sign with configured certificate + timestamp authority (TSA).
   - **Post-Sign Validation:** Re-read and validate the output file with `c2pa-node`. If validation fails, fail the item and do not upload the output.
   - Upload signed file to `/outputs/:jobId/:itemId` with `expires_at` (e.g., 7 days).
   - **Privacy:** Delete `/inputs/:jobId/:itemId` from R2/S3 and local temp disk immediately.
5. **Download & Share (`S18`, `S20`):** User downloads individual files or a streamed `.zip` archive, and can toggle a `PublicCredential` (`/p/:slug`) which stores the public verification summary (thumbnail, signer, self-declared disclosure, caveat, and a "Re-check file" link to `/verify`).

### C. Trust List & Signing Certificates (Hard Parts #1 & #3)
- **Trust List Sync:** A scheduled `pg-boss` cron job fetches the official C2PA Trust List daily, verifies its integrity, and stores a new `TrustListSnapshot` if the `sha256` changed.
- **Certificate Strategy:**
  - **Environment Flag `SIGNING_MODE=test | ca`:** MVP launches with `test` (ephemeral/self-signed cert) so the entire product works end-to-end; Verify UI honestly shows `Unrecognized` for test-signed files.
  - **Production:** Swap in a CA-issued C2PA certificate (e.g., DigiCert or SSL.com) or managed signing API once C2PA Conformance Program onboarding is complete.

---

## 6. Phased Implementation Plan

1. **Phase 1 — Public Checker (`/verify`):** Next.js app + `@contentauth/c2pa-web` + Trust List sync + S01–S04 states + G5/G6 copy.
2. **Phase 2 — Auth, Workspaces & Batch Signer:** Postgres + Drizzle + `pg-boss` + Node 22+ `c2pa-node` worker + S14–S16, S18–S19 + G2/G3/G4 enforcement + auto-deletion of inputs.
3. **Phase 3 — Credits, Billing & Public Proof:** Idempotent `CreditLedgerEntry` + MoR billing checkout/webhooks (S17) + `/p/:slug` public proof pages (S20).
4. **Phase 4 — Growth & Automation:** Developer API keys (`/app/developers`, S21), Chrome extension (S13), MP4/MOV support, and CAWG identity assertions.
