import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { logStructured } from "./security";

function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS || "admin@jinglestudio.io")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export type GoogleSignInOutcome =
  | { ok: true; userId: string; role: string; isNewUser: boolean }
  | { ok: false; code: "Unverified" | "Disabled" | "LinkRequired" | "Configuration" };

export async function resolveGoogleSignIn(params: {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<GoogleSignInOutcome> {
  if (!params.emailVerified || !params.email) {
    logStructured("warn", "google_signin_rejected", { reason: "unverified" });
    return { ok: false, code: "Unverified" };
  }

  const db = await getDb();
  const normalizedEmail = params.email.trim().toLowerCase();
  const now = new Date();

  // 1. Lookup by (provider, providerAccountId) — Google's "sub"
  const linkedAccounts = await db
    .select({
      userId: schema.users.id,
      role: schema.users.role,
      disabled: schema.users.disabled,
    })
    .from(schema.accounts)
    .innerJoin(schema.users, eq(schema.accounts.userId, schema.users.id))
    .where(
      and(
        eq(schema.accounts.provider, "google"),
        eq(schema.accounts.providerAccountId, params.providerAccountId)
      )
    );

  if (linkedAccounts.length > 0) {
    const existing = linkedAccounts[0];
    if (existing.disabled) {
      logStructured("warn", "google_signin_rejected", {
        userId: existing.userId,
        reason: "disabled",
      });
      return { ok: false, code: "Disabled" };
    }

    await db
      .update(schema.users)
      .set({
        name: params.name ?? undefined,
        avatarUrl: params.avatarUrl ?? undefined,
        lastLoginAt: now,
      })
      .where(eq(schema.users.id, existing.userId));

    logStructured("info", "google_signin_success", {
      userId: existing.userId,
      provider: "google",
      returning: true,
    });

    return { ok: true, userId: existing.userId, role: existing.role, isNewUser: false };
  }

  // 2. Check if an account with this lowercase email already exists
  const existingUsers = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail));

  if (existingUsers.length > 0) {
    const u = existingUsers[0];
    if (u.disabled) {
      logStructured("warn", "google_signin_rejected", {
        userId: u.id,
        reason: "disabled",
      });
      return { ok: false, code: "Disabled" };
    }

    // Link ONLY if existing account's email is already verified
    if (!u.emailVerified) {
      logStructured("warn", "google_signin_rejected", {
        userId: u.id,
        reason: "link_required_unverified_existing",
      });
      return { ok: false, code: "LinkRequired" };
    }

    await db
      .insert(schema.accounts)
      .values({
        id: crypto.randomUUID(),
        userId: u.id,
        type: "oidc",
        provider: "google",
        providerAccountId: params.providerAccountId,
      })
      .onConflictDoNothing();

    await db
      .update(schema.users)
      .set({
        name: params.name ?? u.name,
        avatarUrl: params.avatarUrl ?? u.avatarUrl,
        lastLoginAt: now,
      })
      .where(eq(schema.users.id, u.id));

    logStructured("info", "google_signin_linked", {
      userId: u.id,
      provider: "google",
    });

    return { ok: true, userId: u.id, role: u.role, isNewUser: false };
  }

  // 3. New user: create user, personal workspace, owner membership, welcome credits & account in one transaction
  const newUserId = crypto.randomUUID();
  const role = isAdminEmail(normalizedEmail) ? "admin" : "user";
  const displayName = params.name?.trim() || normalizedEmail.split("@")[0];

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: newUserId,
        email: normalizedEmail,
        name: displayName,
        avatarUrl: params.avatarUrl || null,
        emailVerified: now,
        role,
        disabled: false,
        lastLoginAt: now,
      });

      const workspaceId = crypto.randomUUID();
      await tx.insert(schema.workspaces).values({
        id: workspaceId,
        name: `${displayName}'s Workspace`,
        ownerId: newUserId,
      });

      await tx.insert(schema.memberships).values({
        id: crypto.randomUUID(),
        workspaceId,
        userId: newUserId,
        role: "owner",
      });

      await tx.insert(schema.creditLedgerEntries).values({
        id: crypto.randomUUID(),
        workspaceId,
        delta: 10,
        reason: "welcome_bonus",
        idempotencyKey: `welcome:${workspaceId}`,
      });

      await tx.insert(schema.accounts).values({
        id: crypto.randomUUID(),
        userId: newUserId,
        type: "oidc",
        provider: "google",
        providerAccountId: params.providerAccountId,
      });
    });

    logStructured("info", "google_signin_new_user", {
      userId: newUserId,
      provider: "google",
    });

    return { ok: true, userId: newUserId, role, isNewUser: true };
  } catch {
    // Handle simultaneous first sign-in race: retry lookup cleanly
    const retry = await db
      .select({
        userId: schema.users.id,
        role: schema.users.role,
        disabled: schema.users.disabled,
      })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail));

    if (retry.length > 0 && !retry[0].disabled) {
      return { ok: true, userId: retry[0].userId, role: retry[0].role, isNewUser: false };
    }
    return { ok: false, code: "Configuration" };
  }
}
