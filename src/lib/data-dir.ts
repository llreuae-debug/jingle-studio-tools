import os from "node:os";
import path from "node:path";

/**
 * Resolves a directory for persistent local data (.pglite / .storage) that survives
 * versioned deployments on Hostinger and uses writable temp storage on Vercel.
 */
export function resolvePersistentDataDir(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env
): string {
  if (env.APP_DATA_DIR?.trim()) {
    return env.APP_DATA_DIR.trim();
  }

  const hostingerMatch = cwd.match(/^(.+)\/hbuilds\/versions\/[^/]+(?:\/.*)?$/);
  if (hostingerMatch) {
    return path.join(hostingerMatch[1], "app-data");
  }

  if (env.VERCEL === "1") {
    return path.join(os.tmpdir(), "jingle-studio-data");
  }

  return cwd;
}
