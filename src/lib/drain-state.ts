import { randomBytes } from "node:crypto";
import { estado } from "./turnos";

// One state per Node process, including between separately bundled route chunks.
type Cola = {
  instancia: string;
  admitidas: number;
  lease: string | null;
};
const proceso = globalThis as typeof globalThis & { __pixelForgeColaV1?: Cola };
export const cola = proceso.__pixelForgeColaV1 ??= {
  instancia: randomBytes(16).toString("hex"), admitidas: 0, lease: null,
};

// Call before the first await in the upload/processing region and release only
// after its cleanup. A request already admitted can continue during a drain.
export function admitir(): (() => void) | null {
  if (cola.lease !== null) return null;
  cola.admitidas++;
  let abierta = true;
  return () => {
    if (!abierta) return;
    abierta = false;
    cola.admitidas--;
  };
}

export function controlar(linea: string) {
  const coincidencia = /^(begin|status|resume) ([a-f0-9]{32})$/.exec(linea);
  if (!coincidencia) return { ok: false };
  const [, accion, lease] = coincidencia;
  if (accion === "begin" && cola.lease === null) cola.lease = lease;
  if (lease !== cola.lease) return { ok: false };
  if (accion === "resume") cola.lease = null;
  const admitidas = cola.admitidas;
  const { activos, esperando } = estado();
  const cerrado = cola.lease !== null;
  return {
    ok: true, instancia: cola.instancia, cerrado, admitidas, activos, esperando,
    listo: cerrado && admitidas === 0 && activos === 0 && esperando === 0,
  };
}
