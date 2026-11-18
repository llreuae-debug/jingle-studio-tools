import crypto from "node:crypto";
import { cookies } from "next/headers";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DrizzleAuthAdapter } from "./auth-adapter";
import { grantWelcomeCredits } from "./credits";
import { resolveGoogleSignIn } from "./google-signin";
import { sanitizeReturnPath } from "./safe-redirect";
import { logStructured } from "./security";

function validateAuthConfig() {
  const isProdBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !isProdBuild && !process.env.AUTH_SECRET) {
    throw new Error(
      "Missing required environment variable AUTH_SECRET in production."
    );
  }
}

validateAuthConfig();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected));
}

function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS || "admin@jinglestudio.io")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function isGoogleSignInConfigured(): boolean {
  const id = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  return Boolean(id && secret);
}

export async function ensureUserAndWorkspace(params: {
  email: string;
  name?: string | null;
  password?: string;
}) {
  const db = await getDb();
  const normalizedEmail = params.email.trim().toLowerCase();

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail));

  if (existing.length > 0) {
    const user = existing[0];
    if (user.disabled) return null;
    if (params.password && user.passwordHash) {
      if (!verifyPassword(params.password, user.passwordHash)) {
        return null;
      }
    }
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));
    return user;
  }

  const userId = crypto.randomUUID();
  const role = isAdminEmail(normalizedEmail) ? "admin" : "user";
  const passwordHash = params.password ? hashPassword(params.password) : null;

  await db.insert(schema.users).values({
    id: userId,
    email: normalizedEmail,
    name: params.name || normalizedEmail.split("@")[0],
    passwordHash,
    role,
    disabled: false,
    lastLoginAt: new Date(),
  });

  const workspaceId = crypto.randomUUID();
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: `${params.name || normalizedEmail.split("@")[0]}'s Workspace`,
    ownerId: userId,
  });

  await db.insert(schema.memberships).values({
    id: crypto.randomUUID(),
    workspaceId,
    userId,
    role: "owner",
  });

  await grantWelcomeCredits(workspaceId, 10);

  const created = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return created[0];
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  logStructured("info", "sessions_revoked_all", { userId });
}

const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

const providers = [
  ...(googleClientId && googleClientSecret
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          allowDangerousEmailAccountLinking: false,
          authorization: {
            params: {
              scope: "openid email profile",
            },
          },
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAuthAdapter(),
  providers,
  trustHost: true,
  secret: process.env.AUTH_SECRET || "dev-jingle-studio-auth-secret-change-in-prod",
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const googleProfile = profile as
          | {
              sub?: string;
              email?: string;
              email_verified?: boolean;
              name?: string;
              picture?: string;
            }
          | undefined;

        const sub = googleProfile?.sub || account.providerAccountId;
        const email = googleProfile?.email || user.email || "";
        const emailVerified = Boolean(googleProfile?.email_verified);

        const outcome = await resolveGoogleSignIn({
          providerAccountId: sub,
          email,
          emailVerified,
          name: googleProfile?.name || user.name,
          avatarUrl: googleProfile?.picture || user.image,
        });

        if (!outcome.ok) {
          return `/login?error=${outcome.code}`;
        }

        user.id = outcome.userId;
        (user as { role?: string }).role = outcome.role;
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${sanitizeReturnPath(url, "/app")}`;
      }
      try {
        const target = new URL(url);
        const base = new URL(baseUrl);
        if (target.origin === base.origin) {
          return target.toString();
        }
      } catch {
        // fallback below
      }
      return `${baseUrl}/app`;
    },
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        (session.user as { role?: string }).role =
          (user as { role?: string }).role || "user";
        session.user.image =
          (user as { avatarUrl?: string | null }).avatarUrl || user.image || null;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      if ("session" in message && message.session?.sessionToken) {
        const db = await getDb();
        await db
          .delete(schema.sessions)
          .where(eq(schema.sessions.sessionToken, message.session.sessionToken));
        logStructured("info", "session_signed_out", {
          userId: message.session.userId,
        });
      }
    },
  },
});

export interface SessionContext {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    role: string;
  };
  workspace: {
    id: string;
    name: string;
    ownerId: string;
  };
  membership: {
    id: string;
    role: string;
  };
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const db = await getDb();
  const userRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id));

  if (userRows.length === 0 || userRows[0].disabled) return null;
  const user = userRows[0];

  const memberRows = await db
    .select({
      membershipId: schema.memberships.id,
      membershipRole: schema.memberships.role,
      workspaceId: schema.workspaces.id,
      workspaceName: schema.workspaces.name,
      ownerId: schema.workspaces.ownerId,
    })
    .from(schema.memberships)
    .innerJoin(
      schema.workspaces,
      eq(schema.memberships.workspaceId, schema.workspaces.id)
    )
    .where(eq(schema.memberships.userId, user.id));

  if (memberRows.length === 0) return null;

  const cookieStore = await cookies();
  const preferredWsId = cookieStore.get("jingle_ws")?.value;
  const active =
    memberRows.find((r) => r.workspaceId === preferredWsId) || memberRows[0];

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    workspace: {
      id: active.workspaceId,
      name: active.workspaceName,
      ownerId: active.ownerId,
    },
    membership: {
      id: active.membershipId,
      role: active.membershipRole,
    },
  };
}
