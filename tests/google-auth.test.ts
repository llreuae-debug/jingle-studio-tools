import crypto from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, auth: async () => null, signIn: async () => {}, signOut: async () => {} }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/google", () => ({ default: () => ({}) }));

import { getDb, resetDbForTests, schema } from "@/db";
import { revokeAllUserSessions } from "@/lib/auth";
import { resolveGoogleSignIn } from "@/lib/google-signin";
import { sanitizeReturnPath } from "@/lib/safe-redirect";

beforeAll(() => {
  process.env.DATABASE_URL = "pglite://:memory:";
  resetDbForTests();
});

describe("Google Sign-In Rules & Safe Redirects", () => {
  it("creates one user, one workspace, and 10 credits for a new Google user, and updates returning user", async () => {
    const db = await getDb();
    const res1 = await resolveGoogleSignIn({
      providerAccountId: "sub-new-1",
      email: "NewUser@Example.com",
      emailVerified: true,
      name: "New User",
      avatarUrl: "https://lh3.googleusercontent.com/a/avatar1",
    });

    expect(res1.ok).toBe(true);
    if (!res1.ok) return;
    expect(res1.isNewUser).toBe(true);

    const wsRows = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.ownerId, res1.userId));
    expect(wsRows).toHaveLength(1);

    // Returning user updates name/avatar without creating another workspace
    const res2 = await resolveGoogleSignIn({
      providerAccountId: "sub-new-1",
      email: "newuser@example.com",
      emailVerified: true,
      name: "Updated Name",
      avatarUrl: "https://lh3.googleusercontent.com/a/avatar2",
    });
    expect(res2.ok).toBe(true);
    if (!res2.ok) return;
    expect(res2.isNewUser).toBe(false);
    expect(res2.userId).toBe(res1.userId);

    const userRow = (
      await db.select().from(schema.users).where(eq(schema.users.id, res1.userId))
    )[0];
    expect(userRow.name).toBe("Updated Name");
    expect(userRow.avatarUrl).toBe("https://lh3.googleusercontent.com/a/avatar2");
    expect(userRow.lastLoginAt).not.toBeNull();
  });

  it("creates no duplicates on parallel first sign-ins", async () => {
    const db = await getDb();
    const [a, b] = await Promise.all([
      resolveGoogleSignIn({
        providerAccountId: "sub-parallel-1",
        email: "parallel@example.com",
        emailVerified: true,
        name: "Parallel User",
      }),
      resolveGoogleSignIn({
        providerAccountId: "sub-parallel-1",
        email: "parallel@example.com",
        emailVerified: true,
        name: "Parallel User",
      }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.userId).toBe(b.userId);
    }

    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "parallel@example.com"));
    expect(users).toHaveLength(1);
  });

  it("rejects unverified Google emails and disabled users", async () => {
    const db = await getDb();
    const unverified = await resolveGoogleSignIn({
      providerAccountId: "sub-unverified",
      email: "unverified-google@example.com",
      emailVerified: false,
    });
    expect(unverified).toEqual({ ok: false, code: "Unverified" });

    const created = await resolveGoogleSignIn({
      providerAccountId: "sub-to-disable",
      email: "disabled-user@example.com",
      emailVerified: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await db
      .update(schema.users)
      .set({ disabled: true })
      .where(eq(schema.users.id, created.userId));

    const blocked = await resolveGoogleSignIn({
      providerAccountId: "sub-to-disable",
      email: "disabled-user@example.com",
      emailVerified: true,
    });
    expect(blocked).toEqual({ ok: false, code: "Disabled" });
  });

  it("links existing verified email account, and rejects unverified existing account", async () => {
    const db = await getDb();
    const unverifiedId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: unverifiedId,
      email: "existing-unverified@example.com",
      emailVerified: null,
      role: "user",
      disabled: false,
    });

    const linkDenied = await resolveGoogleSignIn({
      providerAccountId: "sub-link-1",
      email: "existing-unverified@example.com",
      emailVerified: true,
    });
    expect(linkDenied).toEqual({ ok: false, code: "LinkRequired" });

    const verifiedId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: verifiedId,
      email: "existing-verified@example.com",
      emailVerified: new Date(),
      role: "user",
      disabled: false,
    });

    const linkOk = await resolveGoogleSignIn({
      providerAccountId: "sub-link-2",
      email: "existing-verified@example.com",
      emailVerified: true,
    });
    expect(linkOk.ok).toBe(true);
    if (linkOk.ok) expect(linkOk.userId).toBe(verifiedId);
  });

  it("revokes all database sessions on sign out of all devices", async () => {
    const db = await getDb();
    const res = await resolveGoogleSignIn({
      providerAccountId: "sub-sessions",
      email: "sessions@example.com",
      emailVerified: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    await db.insert(schema.sessions).values([
      {
        sessionToken: "tok-1",
        userId: res.userId,
        expires: new Date(Date.now() + 3600_000),
      },
      {
        sessionToken: "tok-2",
        userId: res.userId,
        expires: new Date(Date.now() + 3600_000),
      },
    ]);

    await revokeAllUserSessions(res.userId);
    const remaining = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, res.userId));
    expect(remaining).toHaveLength(0);
  });

  it("sanitizes return paths and rejects external or encoded bypass URLs", () => {
    expect(sanitizeReturnPath("/app/sign")).toBe("/app/sign");
    expect(sanitizeReturnPath("/tools/instagram-post-check?lang=id")).toBe(
      "/tools/instagram-post-check?lang=id"
    );
    expect(sanitizeReturnPath("https://evil.com")).toBe("/app");
    expect(sanitizeReturnPath("//evil.com")).toBe("/app");
    expect(sanitizeReturnPath("/%2f%2fevil.com")).toBe("/app");
    expect(sanitizeReturnPath("/\\evil.com")).toBe("/app");
    expect(sanitizeReturnPath("javascript:alert(1)")).toBe("/app");
  });
});
