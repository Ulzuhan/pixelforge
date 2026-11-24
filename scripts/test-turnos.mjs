import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import {
  conTurno,
  estado,
  ColaLlena,
  MemoriaInsuficiente,
  TrabajoCancelado,
  _resetParaPruebas,
} from "../src/lib/turnos.ts";

async function run() {
  // 1. 4 concurrent jobs with MAX_JOBS=1 run 1-at-a-time in exact FIFO order
  _resetParaPruebas();
  process.env.PIXELFORGE_MAX_JOBS = "1";
  process.env.PIXELFORGE_MAX_QUEUE = "12";
  process.env.PIXELFORGE_MIN_MEM_AVAILABLE_MB = "0";
  process.env.PIXELFORGE_MIN_CGROUP_FREE_MB = "0";
  process.env.PIXELFORGE_MEM_POLL_MS = "100";
  process.env.PIXELFORGE_MAX_WAIT_MS = "5000";

  let active = 0;
  let maxObserved = 0;
  const order = [];
  await Promise.all(
    [0, 1, 2, 3].map((i) =>
      conTurno(async () => {
        active++;
        if (active > maxObserved) maxObserved = active;
        order.push(i);
        await delay(30);
        active--;
      })
    )
  );
  assert.equal(maxObserved, 1, "max concurrent must be 1");
  assert.deepEqual(order, [0, 1, 2, 3], "FIFO order mismatch");
  assert.deepEqual(estado(), { activos: 0, esperando: 0, max: 1, aplazadoPorMemoria: false });

  // 2. Low memory initially -> deferred -> recovers after 280ms and runs
  _resetParaPruebas();
  process.env.PIXELFORGE_MEM_POLL_MS = "100";
  process.env.PIXELFORGE_MAX_WAIT_MS = "3000";
  let memOk = false;
  setTimeout(() => { memOk = true; }, 280);
  const t0 = Date.now();
  let ran = false;
  const jobPromise = conTurno(
    async () => { ran = true; return "done"; },
    { checkMemoria: () => (memOk ? { ok: true } : { ok: false, motivo: "test low mem" }) }
  );
  await delay(50);
  assert.equal(ran, false, "job must not start while memory is low");
  assert.equal(estado().aplazadoPorMemoria, true, "expected aplazadoPorMemoria=true");
  assert.equal(estado().esperando, 1);
  const res = await jobPromise;
  assert.equal(res, "done");
  assert.ok(Date.now() - t0 >= 250, "should have waited for memory recovery");
  assert.deepEqual(estado(), { activos: 0, esperando: 0, max: 1, aplazadoPorMemoria: false });

  // 3. Persistent low memory past MAX_WAIT_MS -> rejects with MemoriaInsuficiente
  _resetParaPruebas();
  process.env.PIXELFORGE_MEM_POLL_MS = "100";
  process.env.PIXELFORGE_MAX_WAIT_MS = "500";
  await assert.rejects(
    () => conTurno(async () => "never", { checkMemoria: () => ({ ok: false, motivo: "test exhausted" }) }),
    (e) => e instanceof MemoriaInsuficiente
  );
  await delay(150);
  assert.deepEqual(estado(), { activos: 0, esperando: 0, max: 1, aplazadoPorMemoria: false });

  // 4. Queue overflow: MAX_JOBS=1, MAX_QUEUE=1 -> 3rd concurrent throws ColaLlena
  _resetParaPruebas();
  process.env.PIXELFORGE_MAX_JOBS = "1";
  process.env.PIXELFORGE_MAX_QUEUE = "1";
  process.env.PIXELFORGE_MAX_WAIT_MS = "3000";
  let release1;
  const p1 = conTurno(() => new Promise((r) => { release1 = r; }), { checkMemoria: () => ({ ok: true }) });
  const p2 = conTurno(async () => "second", { checkMemoria: () => ({ ok: true }) });
  await assert.rejects(
    () => conTurno(async () => "third", { checkMemoria: () => ({ ok: true }) }),
    (e) => e instanceof ColaLlena
  );
  release1();
  await p1;
  assert.equal(await p2, "second");
  assert.deepEqual(estado(), { activos: 0, esperando: 0, max: 1, aplazadoPorMemoria: false });

  // 5. AbortSignal aborts queued/deferred job cleanly without blocking next job
  _resetParaPruebas();
  process.env.PIXELFORGE_MAX_JOBS = "1";
  process.env.PIXELFORGE_MAX_QUEUE = "5";
  process.env.PIXELFORGE_MEM_POLL_MS = "100";
  process.env.PIXELFORGE_MAX_WAIT_MS = "5000";
  const ac = new AbortController();
  const deferred = conTurno(async () => "never", {
    signal: ac.signal,
    checkMemoria: () => ({ ok: false, motivo: "blocked" }),
  });
  await delay(30);
  assert.equal(estado().esperando, 1);
  ac.abort();
  await assert.rejects(() => deferred, (e) => e instanceof TrabajoCancelado);
  assert.deepEqual(estado(), { activos: 0, esperando: 0, max: 1, aplazadoPorMemoria: false });
  const after = await conTurno(async () => "ok", { checkMemoria: () => ({ ok: true }) });
  assert.equal(after, "ok");

  // 6. globalThis singleton anchored
  const g = globalThis;
  const st = g[Symbol.for("pixelforge.turnos.v1")];
  assert.ok(st && typeof st.activos === "number" && Array.isArray(st.esperando), "missing globalThis singleton");

  console.log("TURNOS_UNIT_TESTS_OK (6 scenarios passed)");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
