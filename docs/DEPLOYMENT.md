# Deployment & Operations Guide

Jingle Studio Tools ("SynthID Remover — AI Media Inspector & Privacy Cleaner") runs on **Next.js 15 (App Router)** with **Drizzle ORM** (PostgreSQL in production or PGlite in single-node/dev), **Auth.js v5**, pure-Node lossless container inspection/cleaning, and **@contentauth/c2pa-node / @contentauth/c2pa-web** C2PA signing & verification.

---

## 1. Environment Variables

Copy `.env.example` and configure these variables on your hosting provider:

### Required in Production
- `AUTH_SECRET` — Random 32+ byte secret (`openssl rand -base64 32`). Required at runtime.
- `AUTH_URL` — Canonical site URL (e.g. `https://jinglestudio.io` or `https://jingle-studio-tools.vercel.app`).
- `NEXT_PUBLIC_APP_URL` — Same canonical public URL.
- `ADMIN_EMAILS` — Comma-separated emails automatically granted `role = "admin"` on first signup/login.

### Google OAuth
- `AUTH_GOOGLE_ID` — Google Cloud OAuth 2.0 Web Client ID.
- `AUTH_GOOGLE_SECRET` — Google Cloud OAuth 2.0 Client Secret.
- Authorized redirect URIs in Google Cloud Console must include:
  - `https://<your-domain>/api/auth/callback/google`

### Database
- `DATABASE_URL`:
  - **PostgreSQL (Recommended for serverless/multi-instance Vercel)**: `postgresql://user:pass@host:5432/dbname?sslmode=require`
  - **Single-node persistent PGlite (Hostinger / VM)**: Omit `DATABASE_URL` and the app persists safely under `resolvePersistentDataDir()` (`/home/<user>/domains/<domain>/app-data/.pglite` on Hostinger or `/tmp/jingle-studio-data` on Vercel).
- Database tables (`users`, `sessions`, `workspaces`, `media_processing_records`, `pricing_plans`, `user_subscriptions`, `system_logs`, etc.) and default `pricing_plans` (`free`, `pro`, `business`) are **auto-migrated idempotently on boot** via `INIT_SQL` in `src/db/index.ts`.

### Private Storage & Expiry
- **S3 / R2 / Compatible Bucket (Production multi-instance)**:
  - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- **Local Private Storage Fallback**: Omit S3 vars; files are saved outside public webroot and served exclusively through HMAC-signed expiring URLs (`/api/privacy-clean/download`, `/api/files/download`) with strict per-user/workspace ownership checks.

---

## 2. Hosting Configuration

### Vercel Deployment
```bash
vercel --yes --prod
```
- Large uploads (`> 3.5 MB`) automatically use `/api/privacy-clean/upload-init` + `/api/privacy-clean/upload-chunk` (2 MB chunks) so Vercel serverless body limits do not block supported videos.

### Hostinger Node.js Deployment
- Runtime: **Node.js 22**, Framework: **Next.js (`next build`)** (`node_modules/@contentauth/c2pa-web/inline` fallback handles hosts without newer `GLIBCXX_3.4.26`).
- All runtime secrets (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `DATABASE_URL`) are stored in Hostinger environment variables, never committed to Git.

---

## 3. Verification & Health Checks

After deploying:
1. `GET /api/health` -> expects `HTTP 200` and `{"ok":true,"db":"connected",...}`
2. `GET /api/example-report` -> expects `HTTP 200` with live signed C2PA report JSON
3. `GET /tools` -> expects `HTTP 200`
4. Super Admin panel (`/admin`) displays real-time API health, total/daily active users, upload breakdown, storage usage, configurable pricing plans, system logs, and `Purge expired files` control.
