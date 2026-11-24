import { readFileSync } from "node:fs";
import os from "node:os";

/**
 * Cola única compartida entre todos los usuarios y rutas (/api/removebg y
 * /api/vectorize). Solo deja correr PIXELFORGE_MAX_JOBS trabajos a la vez (1
 * por defecto) y comprueba antes de arrancar que haya margen real de memoria
 * libre tanto en el host (/proc/meminfo MemAvailable) como en el cgroup.
 */
function leerEnteroEnv(nombre: string, porDefecto: number, min: number, max: number): number {
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo.trim() === "") return porDefecto;
  const n = Number(crudo);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : porDefecto;
}

export class ColaLlena extends Error {
  constructor(mensaje = "too_busy") {
    super(mensaje);
    this.name = "ColaLlena";
  }
}

export class MemoriaInsuficiente extends Error {
  constructor(motivo = "low_memory") {
    super(motivo);
    this.name = "MemoriaInsuficiente";
  }
}

export class TrabajoCancelado extends Error {
  constructor() {
    super("cancelled");
    this.name = "TrabajoCancelado";
  }
}

export interface ResultadoMemoria {
  ok: boolean;
  memAvailableMiB: number;
  minMemMiB: number;
  cgroupFreeMiB: number | null;
  minCgroupMiB: number;
  motivo?: string;
}

export function leerMemoriaDisponible(): ResultadoMemoria {
  const minMemMiB = leerEnteroEnv("PIXELFORGE_MIN_MEM_AVAILABLE_MB", 1024, 0, 65536);
  const minCgroupMiB = leerEnteroEnv("PIXELFORGE_MIN_CGROUP_FREE_MB", 768, 0, 65536);

  let memAvailableBytes = os.freemem();
  try {
    const info = readFileSync("/proc/meminfo", "utf8");
    const m = /^MemAvailable:\s+(\d+)\s+kB$/m.exec(info);
    if (m) memAvailableBytes = Number(m[1]) * 1024;
  } catch {}
  const memAvailableMiB = Math.floor(memAvailableBytes / (1024 * 1024));

  let cgroupFreeMiB: number | null = null;
  try {
    const rawMax = readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
    if (rawMax !== "max") {
      const maxBytes = Number(rawMax);
      const curBytes = Number(readFileSync("/sys/fs/cgroup/memory.current", "utf8").trim());
      if (Number.isFinite(maxBytes) && Number.isFinite(curBytes)) {
        cgroupFreeMiB = Math.max(0, Math.floor((maxBytes - curBytes) / (1024 * 1024)));
      }
    }
  } catch {}

  const motivos: string[] = [];
  if (minMemMiB > 0 && memAvailableMiB < minMemMiB) {
    motivos.push(`host MemAvailable ${memAvailableMiB} MiB < ${minMemMiB} MiB`);
  }
  if (minCgroupMiB > 0 && cgroupFreeMiB !== null && cgroupFreeMiB < minCgroupMiB) {
    motivos.push(`cgroup libre ${cgroupFreeMiB} MiB < ${minCgroupMiB} MiB`);
  }

  return {
    ok: motivos.length === 0,
    memAvailableMiB,
    minMemMiB,
    cgroupFreeMiB,
    minCgroupMiB,
    ...(motivos.length > 0 ? { motivo: motivos.join("; ") } : {}),
  };
}

export type ComprobadorMemoria = () => { ok: boolean; motivo?: string };

interface Espera {
  empezar: () => void;
  cancelarPorTiempo: () => void;
  abortar: () => void;
  checkMemoria?: ComprobadorMemoria;
}

interface EstadoCola {
  activos: number;
  esperando: Espera[];
  timerMemoria: ReturnType<typeof setTimeout> | null;
  ultimaRazonEspera: string | null;
  ultimoLogMemoria: number;
}

const CLAVE_ESTADO = Symbol.for("pixelforge.turnos.v1");

function obtenerEstado(): EstadoCola {
  const g = globalThis as Record<PropertyKey, unknown>;
  let st = g[CLAVE_ESTADO] as EstadoCola | undefined;
  if (!st) {
    st = {
      activos: 0,
      esperando: [],
      timerMemoria: null,
      ultimaRazonEspera: null,
      ultimoLogMemoria: 0,
    };
    g[CLAVE_ESTADO] = st;
  }
  return st;
}

function maxTrabajos(): number {
  return leerEnteroEnv("PIXELFORGE_MAX_JOBS", 1, 1, 16);
}

function maxCola(): number {
  return leerEnteroEnv("PIXELFORGE_MAX_QUEUE", 12, 1, 100);
}

function pollMs(): number {
  return leerEnteroEnv("PIXELFORGE_MEM_POLL_MS", 1500, 100, 15000);
}

function maxEsperaMs(): number {
  return leerEnteroEnv("PIXELFORGE_MAX_WAIT_MS", 90000, 500, 600000);
}

function limpiarTimerSiVacia(st: EstadoCola): void {
  if (st.esperando.length === 0) {
    if (st.timerMemoria) {
      clearTimeout(st.timerMemoria);
      st.timerMemoria = null;
    }
    st.ultimaRazonEspera = null;
  }
}

function despachar(): void {
  const st = obtenerEstado();
  const limite = maxTrabajos();
  while (st.activos < limite && st.esperando.length > 0) {
    const cabeza = st.esperando[0];
    const check = cabeza.checkMemoria ?? leerMemoriaDisponible;
    const mem = check();
    if (!mem.ok) {
      const razon = mem.motivo ?? "memoria insuficiente";
      st.ultimaRazonEspera = razon;
      const ahora = Date.now();
      if (ahora - st.ultimoLogMemoria >= 10000) {
        st.ultimoLogMemoria = ahora;
        console.warn(`[pixelforge] cola: trabajo aplazado por memoria (${razon})`);
      }
      if (!st.timerMemoria) {
        st.timerMemoria = setTimeout(() => {
          st.timerMemoria = null;
          despachar();
        }, pollMs());
      }
      break;
    }
    if (st.timerMemoria) {
      clearTimeout(st.timerMemoria);
      st.timerMemoria = null;
    }
    st.ultimaRazonEspera = null;
    st.esperando.shift();
    st.activos++;
    cabeza.empezar();
  }
}

export function estado(): {
  activos: number;
  esperando: number;
  max: number;
  aplazadoPorMemoria: boolean;
} {
  const st = obtenerEstado();
  return {
    activos: st.activos,
    esperando: st.esperando.length,
    max: maxTrabajos(),
    aplazadoPorMemoria: Boolean(st.timerMemoria),
  };
}

export function _resetParaPruebas(): void {
  const st = obtenerEstado();
  if (st.timerMemoria) {
    clearTimeout(st.timerMemoria);
    st.timerMemoria = null;
  }
  while (st.esperando.length > 0) {
    const e = st.esperando.shift();
    e?.abortar();
  }
  st.activos = 0;
  st.ultimaRazonEspera = null;
  st.ultimoLogMemoria = 0;
}

export interface OpcionesTurno {
  signal?: AbortSignal;
  checkMemoria?: ComprobadorMemoria;
}

export async function conTurno<T>(
  trabajo: () => Promise<T>,
  opciones?: OpcionesTurno
): Promise<T> {
  const signal = opciones?.signal;
  if (signal?.aborted) {
    throw new TrabajoCancelado();
  }

  const st = obtenerEstado();
  const check = opciones?.checkMemoria ?? leerMemoriaDisponible;
  const limite = maxTrabajos();
  const topeCola = maxCola();

  let yaActivo = false;
  if (st.activos < limite && st.esperando.length === 0) {
    const mem = check();
    if (mem.ok) {
      st.activos++;
      st.ultimaRazonEspera = null;
      yaActivo = true;
    }
  }

  if (!yaActivo) {
    if (st.esperando.length >= topeCola) {
      throw new ColaLlena();
    }

    await new Promise<void>((resolve, reject) => {
      let terminado = false;
      let timerEspera: ReturnType<typeof setTimeout> | null = null;

      const limpiar = () => {
        if (timerEspera) {
          clearTimeout(timerEspera);
          timerEspera = null;
        }
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
      };

      const quitarDeCola = () => {
        const idx = st.esperando.indexOf(espera);
        if (idx !== -1) st.esperando.splice(idx, 1);
        limpiarTimerSiVacia(st);
      };

      const onAbort = () => {
        if (terminado) return;
        terminado = true;
        quitarDeCola();
        limpiar();
        reject(new TrabajoCancelado());
        despachar();
      };

      const espera: Espera = {
        checkMemoria: opciones?.checkMemoria,
        empezar: () => {
          if (terminado) return;
          terminado = true;
          limpiar();
          resolve();
        },
        cancelarPorTiempo: () => {
          if (terminado) return;
          terminado = true;
          const razon = st.ultimaRazonEspera;
          const faltaMem = Boolean(razon && st.activos === 0);
          quitarDeCola();
          limpiar();
          reject(faltaMem ? new MemoriaInsuficiente(razon!) : new ColaLlena());
          despachar();
        },
        abortar: onAbort,
      };

      timerEspera = setTimeout(() => {
        espera.cancelarPorTiempo();
      }, maxEsperaMs());

      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      st.esperando.push(espera);
      despachar();
    });
  }

  try {
    return await trabajo();
  } finally {
    st.activos--;
    despachar();
  }
}
