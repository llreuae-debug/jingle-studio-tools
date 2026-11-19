import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { getDb, resetDbForTests, schema } from "@/db";
import { resolvePersistentDataDir } from "@/lib/data-dir";

describe("resolvePersistentDataDir", () => {
  it("resolves Hostinger versioned deploy paths to persistent app-data outside versions/", () => {
    const dir = resolvePersistentDataDir(
      "/home/u216989418/domains/jinglestudio.io/hbuilds/versions/01a1f0cb-c92e-72a4-a79e-5fe2f6e78360/nodejs",
      {} as NodeJS.ProcessEnv
    );
    expect(dir).toBe("/home/u216989418/domains/jinglestudio.io/app-data");
  });

  it("uses writable os.tmpdir()/jingle-studio-data on Vercel", () => {
    const dir = resolvePersistentDataDir("/var/task", {
      VERCEL: "1",
    } as unknown as NodeJS.ProcessEnv);
    expect(dir).toBe(path.join(os.tmpdir(), "jingle-studio-data"));
  });

  it("respects explicit APP_DATA_DIR override", () => {
    const dir = resolvePersistentDataDir(
      "/var/task",
      { APP_DATA_DIR: "/custom/dir", VERCEL: "1" } as unknown as NodeJS.ProcessEnv
    );
    expect(dir).toBe("/custom/dir");
  });

  it("keeps cwd unchanged in local development", () => {
    const dir = resolvePersistentDataDir(
      "/Users/dev/project",
      {} as NodeJS.ProcessEnv
    );
    expect(dir).toBe("/Users/dev/project");
  });

  it("recovers automatically when a persistent PGlite directory has corrupted pg_control", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "pg-recover-"));
    const pgDir = path.join(tmpBase, ".pglite");
    const prevUrl = process.env.DATABASE_URL;

    try {
      const seed = new PGlite(pgDir);
      await seed.waitReady;
      await seed.close();

      // Corrupt global/pg_control to reproduce WASM abort() on startup
      fs.writeFileSync(path.join(pgDir, "global", "pg_control"), Buffer.alloc(10));

      process.env.DATABASE_URL = pgDir;
      resetDbForTests();

      const db = await getDb();
      const plans = await db.select().from(schema.pricingPlans);
      expect(plans.length).toBeGreaterThanOrEqual(3);

      const backups = fs
        .readdirSync(tmpBase)
        .filter((name) => name.startsWith(".pglite.corrupt-"));
      expect(backups.length).toBe(1);
    } finally {
      resetDbForTests();
      if (prevUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevUrl;
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
