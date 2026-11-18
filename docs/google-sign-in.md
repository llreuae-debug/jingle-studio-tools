# Google Sign-In Setup Guide (`jinglestudio.io`)

## 1. Google Cloud & OAuth Configuration
1. **Create or select a Google Cloud project** in the [Google Cloud Console](https://console.cloud.google.com/).
2. Open **Google Auth Platform** (**APIs & Services → OAuth consent screen**) and complete **Branding**:
   - **App name:** `Jingle Studio Tools`
   - **User support email:** `info@jinglestudio.io`
   - **App logo:** Upload `public/brand/google-oauth-logo-120.png` (`120×120` PNG)
   - **Application home page:** `https://jinglestudio.io`
   - **Privacy Policy link:** `https://jinglestudio.io/privacy`
   - **Terms of Service link:** `https://jinglestudio.io/terms`
   - **Authorized domain:** `jinglestudio.io`
3. Set **Audience** to **External** (add test users while in Testing, then **Publish App** when testing is finished).
4. Add **Scopes**:
   - `openid`
   - `email`
   - `profile`
5. Go to **Clients → Create Client** and choose **Web application**.
6. **Authorized JavaScript origins:**
   - `https://jinglestudio.io`
   - `http://localhost:3000`
7. **Authorized redirect URIs:**
   - `https://jinglestudio.io/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
8. Copy the **Client ID** and **Client Secret** and set them in your hosting provider's environment variables:
   - `AUTH_SECRET` (32+ random bytes, e.g. `openssl rand -base64 32`)
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `AUTH_URL=https://jinglestudio.io`
   - `DATABASE_URL` (PostgreSQL connection string)
9. **Redeploy**, then run one real manual test with a Google account that is **not** a Google Cloud project owner.

---

## 2. Common Issues & Fixes

- **`redirect_uri_mismatch`**: Confirm the authorized redirect URI in Google Cloud matches `https://jinglestudio.io/api/auth/callback/google` (exact scheme `https`, no trailing slash) and `AUTH_URL=https://jinglestudio.io` is set.
- **`invalid_client`**: Verify `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` have no leading/trailing spaces and belong to the same Web application client.
- **Access blocked (`403 access_denied` / app not verified)**: While Audience is in **Testing**, only listed test users can sign in; click **Publish App** in Google Auth Platform for general users.
- **Wrong `AUTH_URL`**: If `AUTH_URL` points to `http://localhost:3000` or an old preview URL in production, Auth.js builds the wrong callback URL. Set `AUTH_URL=https://jinglestudio.io`.
- **Missing trusted-host settings behind a proxy**: `trustHost: true` is enabled in `src/lib/auth.ts` so reverse proxies (Hostinger / Vercel) forwarding `X-Forwarded-Host` and `X-Forwarded-Proto` are trusted.
- **Cookies failing on production domain**: Ensure the site is served over HTTPS (`__Secure-authjs.session-token` requires `Secure` in production) and `AUTH_SECRET` is identical across all server instances.

---

## 3. Manual Verification Checklist
1. Visit `https://jinglestudio.io/login` in a regular browser (Chrome/Safari/Firefox/Edge).
2. Click **Continue with Google** using a non-owner Google account with a verified email.
3. Confirm redirect back to `/app`, avatar/name/email in the Account Menu, and a personal workspace with 10 credits.
4. Click **Settings → Sign out of all devices** and confirm `/app` redirects back to `/login`.
