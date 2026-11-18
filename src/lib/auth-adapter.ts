import crypto from "node:crypto";
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

function toAdapterUser(row: typeof schema.users.$inferSelect): AdapterUser & {
  role: string;
  disabled: boolean;
  avatarUrl: string | null;
} {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.avatarUrl,
    avatarUrl: row.avatarUrl,
    emailVerified: row.emailVerified,
    role: row.role,
    disabled: row.disabled,
  };
}

export function DrizzleAuthAdapter(): Adapter {
  return {
    async createUser(data) {
      const db = await getDb();
      const id = data.id || crypto.randomUUID();
      const email = data.email.trim().toLowerCase();
      await db
        .insert(schema.users)
        .values({
          id,
          email,
          name: data.name || email.split("@")[0],
          avatarUrl: data.image || null,
          emailVerified: data.emailVerified || null,
          role: "user",
          disabled: false,
          lastLoginAt: new Date(),
        })
        .onConflictDoNothing();

      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email));
      return toAdapterUser(rows[0]);
    },

    async getUser(id) {
      const db = await getDb();
      const rows = await db.select().from(schema.users).where(eq(schema.users.id, id));
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async getUserByEmail(email) {
      const db = await getDb();
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.trim().toLowerCase()));
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const db = await getDb();
      const rows = await db
        .select({ user: schema.users })
        .from(schema.accounts)
        .innerJoin(schema.users, eq(schema.accounts.userId, schema.users.id))
        .where(
          and(
            eq(schema.accounts.provider, provider),
            eq(schema.accounts.providerAccountId, providerAccountId)
          )
        );
      return rows[0] ? toAdapterUser(rows[0].user) : null;
    },

    async updateUser(data) {
      const db = await getDb();
      if (!data.id) throw new Error("Missing user id");
      await db
        .update(schema.users)
        .set({
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.image !== undefined ? { avatarUrl: data.image } : {}),
          ...(data.emailVerified !== undefined ? { emailVerified: data.emailVerified } : {}),
          lastLoginAt: new Date(),
        })
        .where(eq(schema.users.id, data.id));

      const rows = await db.select().from(schema.users).where(eq(schema.users.id, data.id));
      return toAdapterUser(rows[0]);
    },

    async deleteUser(userId) {
      const db = await getDb();
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    },

    async linkAccount(account: AdapterAccount) {
      // Explicitly omit access_token, refresh_token, id_token
      const db = await getDb();
      await db
        .insert(schema.accounts)
        .values({
          id: crypto.randomUUID(),
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        })
        .onConflictDoNothing();
      return account;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const db = await getDb();
      await db
        .delete(schema.accounts)
        .where(
          and(
            eq(schema.accounts.provider, provider),
            eq(schema.accounts.providerAccountId, providerAccountId)
          )
        );
    },

    async createSession(session: AdapterSession) {
      const db = await getDb();
      await db.insert(schema.sessions).values({
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      });
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const db = await getDb();
      const rows = await db
        .select({
          session: schema.sessions,
          user: schema.users,
        })
        .from(schema.sessions)
        .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
        .where(eq(schema.sessions.sessionToken, sessionToken));

      if (rows.length === 0) return null;
      const { session, user } = rows[0];
      if (user.disabled) return null;
      return {
        session: {
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
        user: toAdapterUser(user),
      };
    },

    async updateSession(session) {
      const db = await getDb();
      await db
        .update(schema.sessions)
        .set({
          ...(session.expires ? { expires: session.expires } : {}),
        })
        .where(eq(schema.sessions.sessionToken, session.sessionToken));

      const rows = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.sessionToken, session.sessionToken));
      if (rows.length === 0) return null;
      return {
        sessionToken: rows[0].sessionToken,
        userId: rows[0].userId,
        expires: rows[0].expires,
      };
    },

    async deleteSession(sessionToken) {
      const db = await getDb();
      await db.delete(schema.sessions).where(eq(schema.sessions.sessionToken, sessionToken));
    },

    async createVerificationToken(token: VerificationToken) {
      const db = await getDb();
      await db.insert(schema.verificationTokens).values({
        identifier: token.identifier,
        token: token.token,
        expires: token.expires,
      });
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const db = await getDb();
      const rows = await db
        .select()
        .from(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, identifier),
            eq(schema.verificationTokens.token, token)
          )
        );
      if (rows.length === 0) return null;
      await db
        .delete(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, identifier),
            eq(schema.verificationTokens.token, token)
          )
        );
      return rows[0];
    },
  };
}
