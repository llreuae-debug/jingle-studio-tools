import crypto from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, auth: async () => null, signIn: async () => {}, signOut: async () => {} }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/google", () => ({ default: () => ({}) }));
import { eq } from "drizzle-orm";
import { Reader } from "@contentauth/c2pa-node";
import { getDb, resetDbForTests, schema } from "@/db";
import { ensureUserAndWorkspace } from "@/lib/auth";
import { signImageWithC2pa } from "@/lib/c2pa-server";
import {
  applyPurchaseCredits,
  getWorkspaceBalance,
  refundFailedItems,
  reserveCreditsForJob,
} from "@/lib/credits";
import { cleanupExpiredOutputs } from "@/lib/job-runner";
import { getPrivateObject, putPrivateObject } from "@/lib/storage";

const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

beforeAll(() => {
  process.env.DATABASE_URL = "pglite://:memory:";
  process.env.SIGNING_MODE = "test";
  resetDbForTests();
});

describe("C2PA & Guardrails", () => {
  it("signs a file, preserves parent ingredient (G2), blocks no_ai on AI ingredient (G4), and detects tampering", async () => {
    const signed = await signImageWithC2pa({
      buffer: SAMPLE_PNG,
      mimeType: "image/png",
      fileName: "ai-origin.png",
      creatorName: "Test Creator",
      aiUse: "full_ai",
      modelType: "imageGeneration",
      modelName: "TestGen",
      doNotTrain: true,
    });
    expect(signed.signedBuffer.length).toBeGreaterThan(SAMPLE_PNG.length);

    // G2: re-sign keeps parent ingredient
    const resigned = await signImageWithC2pa({
      buffer: signed.signedBuffer,
      mimeType: "image/png",
      fileName: "edited.png",
      creatorName: "Editor",
      aiUse: "human_edits_ai",
      doNotTrain: true,
    });
    expect(resigned.hadParentIngredient).toBe(true);

    // G4: block no_ai when AI ingredient exists
    await expect(
      signImageWithC2pa({
        buffer: signed.signedBuffer,
        mimeType: "image/png",
        fileName: "conflict.png",
        creatorName: "Editor",
        aiUse: "no_ai",
        doNotTrain: false,
      })
    ).rejects.toMatchObject({ code: "ERR_DISCLOSURE_CONFLICT" });

    // Tampering shows Invalid
    const tampered = Buffer.from(signed.signedBuffer);
    tampered[tampered.length - 20] ^= 0xff;
    const reader = await Reader.fromAsset({ buffer: tampered, mimeType: "image/png" });
    expect(reader?.json()?.validation_state).toBe("Invalid");
  });

  it("returns null for an unsigned file (no credentials found)", async () => {
    const reader = await Reader.fromAsset({ buffer: SAMPLE_PNG, mimeType: "image/png" });
    expect(reader).toBeNull();
  });
});

describe("Credits, Idempotency, Workspace Isolation, Expiration, and Proof Revocation", () => {
  it("prevents double-charging on duplicate job submission and refunds failed items", async () => {
    const db = await getDb();
    const user = await ensureUserAndWorkspace({
      email: "ledger-test@example.com",
      name: "Ledger User",
    });
    const wsRows = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.ownerId, user!.id));
    const wsId = wsRows[0].id;

    const initial = await getWorkspaceBalance(wsId);
    expect(initial).toBe(10);

    const jobId = crypto.randomUUID();
    const idem = "idem-dup-1";

    const r1 = await reserveCreditsForJob({
      workspaceId: wsId,
      jobId,
      fileCount: 3,
      idempotencyKey: idem,
    });
    const r2 = await reserveCreditsForJob({
      workspaceId: wsId,
      jobId,
      fileCount: 3,
      idempotencyKey: idem,
    });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(await getWorkspaceBalance(wsId)).toBe(7);

    // Refund 2 failed items (idempotent)
    await refundFailedItems({ workspaceId: wsId, jobId, failedCount: 2 });
    await refundFailedItems({ workspaceId: wsId, jobId, failedCount: 2 });
    expect(await getWorkspaceBalance(wsId)).toBe(9);
  });

  it("never credits twice on repeated payment webhook", async () => {
    const db = await getDb();
    const user = await ensureUserAndWorkspace({
      email: "webhook-test@example.com",
      name: "Webhook User",
    });
    const wsRows = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.ownerId, user!.id));
    const wsId = wsRows[0].id;

    const purchaseId = crypto.randomUUID();
    await db.insert(schema.purchases).values({
      id: purchaseId,
      workspaceId: wsId,
      provider: "hosted",
      providerRef: `ref_${purchaseId}`,
      packId: "starter-25",
      amountCents: 900,
      currency: "USD",
      credits: 25,
      status: "pending",
    });

    const first = await applyPurchaseCredits({ workspaceId: wsId, purchaseId, credits: 25 });
    const second = await applyPurchaseCredits({ workspaceId: wsId, purchaseId, credits: 25 });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await getWorkspaceBalance(wsId)).toBe(35);
  });

  it("cleans up expired output files and marks them expired", async () => {
    const db = await getDb();
    const user = await ensureUserAndWorkspace({
      email: "expiry-test@example.com",
      name: "Expiry User",
    });
    const wsRows = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.ownerId, user!.id));
    const wsId = wsRows[0].id;

    const jobId = crypto.randomUUID();
    await db.insert(schema.signJobs).values({
      id: jobId,
      workspaceId: wsId,
      createdBy: user!.id,
      status: "done",
      fileCount: 1,
      creditsReserved: 1,
      idempotencyKey: `exp_${jobId}`,
      creatorName: "Expiry",
    });

    const itemId = crypto.randomUUID();
    const outputKey = `outputs/${wsId}/${jobId}/expired.png`;
    await putPrivateObject(outputKey, SAMPLE_PNG, "image/png");

    await db.insert(schema.signJobItems).values({
      id: itemId,
      jobId,
      originalName: "expired.png",
      mimeType: "image/png",
      inputSha256: "abc",
      outputKey,
      status: "done",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const cleaned = await cleanupExpiredOutputs();
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(await getPrivateObject(outputKey)).toBeNull();
  });
});
