import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { eventOnce, poll, freePort } from "./test-drain-helpers.mjs";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const temp = await mkdtemp("/tmp/pf-drain-");
const port = await freePort();
const base = "http://127.0.0.1:" + port;
const fake = join(temp, "worker");
const dir = join(temp, "private");
const work = join(temp, "work");
const lease = randomBytes(16).toString("hex");
const env = {
  ...process.env, BASE: base, HOSTNAME: "127.0.0.1", PORT: String(port),
  PIXELFORGE_DRAIN_DIR: dir, PIXELFORGE_PYTHON: fake, PIXELFORGE_TMP_DIR: work,
  PIXELFORGE_STATE_DIR: join(temp, "state"),
  PIXELFORGE_SESSION_SECRET: randomBytes(32).toString("hex"),
  PIXELFORGE_MAX_JOBS: "1", PIXELFORGE_MAX_QUEUE: "1",
  // Synthetic worker occupies negligible RAM; host pressure is not under test.
  PIXELFORGE_MIN_MEM_AVAILABLE_MB: "0", PIXELFORGE_MIN_CGROUP_FREE_MB: "0",
};
process.env.BASE = base;
process.env.PIXELFORGE_SESSION_SECRET = env.PIXELFORGE_SESSION_SECRET;
const { sesion, png } = await import("./comun.mjs");
const cookie = sesion({iat: Date.now()});
const log = join(temp, "worker.log");
const gate = join(temp, "release-first");
const body = png(4, 3);

await mkdir(env.PIXELFORGE_STATE_DIR);
await writeFile(log, "");
await writeFile(fake, `#!/bin/sh
set -eu
printf '%s\\n' "$2" >> "${log}"
if [ "$2" = removebg ]; then
  n=0
  while [ ! -f "${gate}" ] && [ "$n" -lt 300 ]; do n=$((n+1)); sleep 0.02; done
  [ -f "${gate}" ]
  cp "$3" "$4"
else
  printf '%s\\n' '<svg xmlns="http://www.w3.org/2000/svg"></svg>' > "$4"
fi
`);
await chmod(fake, 0o700);
const app = spawn(process.execPath, [resolve(".next/standalone/server.js")], {
  env, stdio: ["ignore", "ignore", "pipe"],
});
let stderr = "";
app.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-3000); });
const exited = eventOnce(app, "exit");
const call = async (action, id = lease) => JSON.parse((await exec(process.execPath, [
  "scripts/drain-control.mjs", action, id
], { env, timeout: 2500 })).stdout);
const request = (path) => {
  const form = new FormData();
  form.set("file", new Blob([body], {type: "image/png"}), "probe.png");
  return fetch(base + path, {
    method: "POST", body: form, headers: {cookie}, signal: AbortSignal.timeout(12000),
  });
};
const tasks = [];
try {
  await poll(async () => (await fetch(base + "/", {signal: AbortSignal.timeout(500)})).ok);
  assert.equal((await stat(dir)).mode & 0o777, 0o700);
  assert.equal((await stat(join(dir, "control.sock"))).mode & 0o777, 0o600);
  assert.equal((await fetch(base + "/api/drain/status")).status, 404);
  await assert.rejects(call("status"));
  tasks.push(request("/api/removebg")); tasks[0].catch(() => {});
  await poll(async () => (await readFile(log, "utf8")).includes("removebg"));
  tasks.push(request("/api/vectorize")); tasks[1].catch(() => {});
  // Mark the phase only after we observe the second upload temp directory.
  // With one slot, its worker cannot start before the first completes.
  const { readdir } = await import("node:fs/promises");
  await poll(async () => (await readdir(work)).length === 2);
  const seen = await call("begin");
  assert.equal(seen.cerrado, true);
  assert.match(seen.instancia, /^[a-f0-9]{32}$/);
  assert.equal((await call("begin")).instancia, seen.instancia);
  await assert.rejects(call("begin", randomBytes(16).toString("hex")));
  assert.equal(seen.admitidas, 2);
  assert.equal(seen.activos, 1);
  assert.equal(seen.listo, false);
  await poll(async () => (await call("status")).esperando === 1);
  await assert.rejects(call("resume", randomBytes(16).toString("hex")));
  const rejected = await request("/api/vectorize");
  assert.equal(rejected.status, 503);
  assert.equal(rejected.headers.get("Retry-After"), "30");
  assert.deepEqual(await rejected.json(), {error: "Temporarily unavailable"});
  assert.equal(await readFile(log, "utf8"), "removebg\n");

  await writeFile(gate, "");
  for (const response of await Promise.all(tasks)) {
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  }
  await poll(async () => (await call("status")).listo);
  assert.deepEqual(await call("status"), {
    ok: true, instancia: seen.instancia, cerrado: true, admitidas: 0,
    activos: 0, esperando: 0, listo: true
  });
  assert.deepEqual(await readdir(work), []);
  assert.deepEqual((await readFile(log, "utf8")).trim().split("\n"), ["removebg", "vectorize"]);
  assert.equal((await request("/api/removebg")).status, 503);
  assert.equal((await call("resume")).cerrado, false);
  await assert.rejects(call("status"));
  assert.equal((await request("/api/vectorize")).status, 200);
  console.log("PIXELFORGE_DRAIN_HTTP_OK both routes; queued work completes; private lease and permissions; reopening");
} catch (error) {
  console.error(stderr);
  throw error;
} finally {
  app.kill("SIGTERM");
  const timeout = setTimeout(() => app.kill("SIGKILL"), 2000);
  await exited;
  clearTimeout(timeout);
  await Promise.allSettled(tasks);
  await rm(temp, {recursive: true, force: true});
}
