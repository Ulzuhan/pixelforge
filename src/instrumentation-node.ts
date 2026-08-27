import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = process.env.PIXELFORGE_TMP_DIR?.trim() || join(process.cwd(), ".pixelforge-tmp");
const MAX_AGE_MS = 30 * 60 * 1000;

async function cleanupOrphans() {
  const now = Date.now();
  try {
    for (const name of await readdir(tmpDir)) {
      const target = join(tmpDir, name);
      try {
        const info = await stat(target);
        if (now - info.mtimeMs > MAX_AGE_MS) await rm(target, { recursive: true, force: true });
      } catch {}
    }
  } catch {}
}

void cleanupOrphans();
const timer = setInterval(() => void cleanupOrphans(), 30 * 60 * 1000);
timer.unref();
