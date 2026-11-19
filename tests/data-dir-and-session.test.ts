import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
});
