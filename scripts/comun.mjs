/**
 * Lo que comparten las suites.
 *
 * No hay login local en esta aplicación: la identidad la lleva Authentik entera.
 * Así que para probar cualquier cosa hay que acuñar la cookie de sesión con el
 * mismo secreto que el servidor de pruebas, que es exactamente lo que hace
 * `sesion()`. No es un atajo sospechoso: es la única forma de ejercitar las rutas
 * sin levantar un proveedor de identidad para cada tirada.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

export const BASE = process.env.BASE || "http://127.0.0.1:3991";
export const SECRETO = process.env.PIXELFORGE_SESSION_SECRET || "secreto-de-pruebas-pixelforge-32-bytes-minimo";

let pasan = 0;
let fallan = 0;

export function check(nombre, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  console.log(
    `  ${ok ? "✓" : "✗"} ${nombre}${ok ? "" : `  (esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)})`}`
  );
  if (ok) pasan++;
  else fallan++;
}

export function nota(nombre, valor) {
  console.log(`  · ${nombre}: ${typeof valor === "string" ? valor : JSON.stringify(valor)}`);
}

export function resumen() {
  console.log(`\n${pasan} pasan, ${fallan} fallan`);
  process.exit(fallan === 0 ? 0 : 1);
}

/** Una cookie de sesión firmada como la firmaría la aplicación. */
export function sesion(extra = {}) {
  const carga = Buffer.from(
    JSON.stringify({
      sub: "pruebas-123",
      email: "pruebas@example.invalid",
      name: "Pruebas",
      exp: Date.now() + 3600_000,
      ...extra,
    })
  ).toString("base64url");
  return `pixelforge_session=${carga}.${createHmac("sha256", SECRETO).update(carga).digest("base64url")}`;
}

/** Firma una carga cualquiera, para las sesiones que deben ser rechazadas. */
export function firmar(objeto, secreto = SECRETO) {
  const carga = Buffer.from(JSON.stringify(objeto)).toString("base64url");
  return `pixelforge_session=${carga}.${createHmac("sha256", secreto).update(carga).digest("base64url")}`;
}

/**
 * Una imagen de verdad, generada por el propio script de pruebas.
 *
 * Un PNG escrito a mano byte a byte es una trampa: `file` no comprueba los CRC y
 * libpng sí, así que uno mal formado se rechaza por corrupto y hace parecer
 * cerrada una puerta que está abierta. Éste sale de zlib, con su CRC correcto.
 */
export function png(ancho, alto, relleno = [0x44, 0x88, 0xcc]) {
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const trozo = (tipo, datos) => {
    const cabecera = Buffer.alloc(8);
    cabecera.writeUInt32BE(datos.length, 0);
    cabecera.write(tipo, 4, "ascii");
    const cola = Buffer.alloc(4);
    cola.writeUInt32BE(crc(Buffer.concat([Buffer.from(tipo, "ascii"), datos])), 0);
    return Buffer.concat([cabecera, datos, cola]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // color verdadero, sin alfa
  const fila = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: ancho }, () => relleno).flat())]);
  const crudo = Buffer.concat(Array.from({ length: alto }, () => fila));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

export function leer(ruta) {
  return readFileSync(ruta);
}

/** Envía una imagen a una de las dos rutas de proceso. */
export async function procesar(ruta, { cookie, datos, nombre = "prueba.png", tipo = "image/png", campos = {}, headers = {} } = {}) {
  const fd = new FormData();
  if (datos !== null) fd.set("file", new Blob([datos], { type: tipo }), nombre);
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  const res = await fetch(BASE + ruta, {
    method: "POST",
    body: fd,
    ...((cookie || Object.keys(headers).length) ? { headers: { ...headers, ...(cookie ? { cookie } : {}) } } : {}),
  });
  const bytes = await res.arrayBuffer();
  let cuerpo = null;
  try {
    cuerpo = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {}
  return {
    status: res.status,
    body: cuerpo,
    bytes: bytes.byteLength,
    tipo: res.headers.get("content-type"),
    disp: res.headers.get("content-disposition"),
    nosniff: res.headers.get("x-content-type-options"),
    csp: res.headers.get("content-security-policy"),
    // Si un nombre de fichero hostil llegó a fabricar una cabecera de verdad.
    inyectada: res.headers.get("x-inyectada") !== null,
  };
}
