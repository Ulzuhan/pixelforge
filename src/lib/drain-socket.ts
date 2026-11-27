import { chmod, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { isAbsolute, join } from "node:path";
import { controlar } from "./drain-state";

const proceso = globalThis as typeof globalThis & { __pixelForgeSocketV1?: Promise<void> };

export function iniciarControl(dir: string): Promise<void> {
  return proceso.__pixelForgeSocketV1 ??= abrir(dir);
}

async function abrir(dir: string) {
  const path = join(dir, "control.sock");
  if (!isAbsolute(dir) || Buffer.byteLength(path) > 100) throw new Error("Invalid private drain directory");

  // Must be a fresh directory owned by the process, on private tmpfs in the
  // container. Never adopt stale files or remove someone else's listener.
  await mkdir(dir, { mode: 0o700 });
  const server = createServer(socket => {
    socket.on("error", () => socket.destroy());
    socket.setTimeout(1500, () => socket.destroy());
    let buffer = "";
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("ascii");
      if (buffer.length > 48) { socket.destroy(); return; }
      const fin = buffer.indexOf("\n");
      if (fin < 0) return;
      if (fin !== buffer.length - 1) { socket.destroy(); return; }
      socket.end(JSON.stringify(controlar(buffer.slice(0, fin))) + "\n");
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, () => { server.off("error", reject); resolve(); });
  });
  await chmod(path, 0o600);
}
