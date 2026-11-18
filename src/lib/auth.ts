import crypto from "node:crypto";
import { cookies } from "next/headers";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { grantWelcomeCredits } from "./credits";

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
    if (params.password && user.passwordHash) {
      if (!verifyPassword(params.password, user.passwordHash)) {
        return null;
      }
    }
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

const providers = [
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      name: { label: "Name", type: "text" },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email : "";
      const password =
        typeof credentials?.password === "string" ? credentials.password : "";
      const name = typeof credentials?.name === "string" ? credentials.name : undefined;

      if (!email || !password || password.length < 6) {
        return null;
      }

      const user = await ensureUserAndWorkspace({ email, name, password });
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    },
  }),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  secret: process.env.AUTH_SECRET || "dev-jingle-studio-auth-secret-change-in-prod",
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const dbUser = await ensureUserAndWorkspace({
          email: user.email,
          name: user.name,
        });
        if (dbUser) {
          user.id = dbUser.id;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as { role?: string }).role || "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        (session.user as { role?: string }).role = (token.role as string) || "user";
      }
      return session;
    },
  },
});

export interface SessionContext {
  user: {
    id: string;
    email: string;
    name: string | null;
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

  if (userRows.length === 0) return null;
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
