import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

export const eventOnce = once;
export async function poll(check) {
  const deadline = Date.now() + 5000;
  do {
    try { if (await check()) return; } catch {}
    await sleep(25);
  } while (Date.now() < deadline);
  throw new Error("Fixture condition did not become true");
}

export async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const {port} = server.address();
  server.close();
  await once(server, "close");
  return port;
}
