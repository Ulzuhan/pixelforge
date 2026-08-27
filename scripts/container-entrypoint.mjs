// Deja los cuatro modelos ONNX en U2NET_HOME antes de ceder el control.
//
// POR QUÉ EXISTE: sin esto, el primer trabajo de cada modelo dispara la
// descarga de rembg en caliente — la primera petición tarda minutos y los
// bytes llegan sin más verificación que la del propio rembg. Aquí la descarga
// ocurre al arrancar, con el sha256 FIJADO en este fichero: si lo que sirve el
// origen no es byte a byte el modelo con el que se auditó esta aplicación, el
// servicio se niega a arrancar en vez de procesar imágenes con otra red.
//
// Los modelos van en un volumen, no en la capa de imagen: son ~400 MB que no
// cambian con el código, y meterlos en la imagen la haría impublicable. Un
// despliegue sin salida a internet puede sembrar el volumen copiando los
// .onnx a mano; si ya existen, aquí no se descarga nada.
//
// La lista es la misma lista blanca de src/app/api/removebg/route.ts.
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const DESTINO = process.env.U2NET_HOME || "/models";
const BASE = "https://github.com/danielgatis/rembg/releases/download/v0.0.0";
const MODELOS = [
  { fichero: "isnet-general-use.onnx", sha256: "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a" },
  { fichero: "u2net.onnx", sha256: "8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491" },
  { fichero: "silueta.onnx", sha256: "75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb" },
  { fichero: "u2netp.onnx", sha256: "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8" },
];

for (const { fichero, sha256 } of MODELOS) {
  const ruta = join(DESTINO, fichero);
  try {
    await stat(ruta);
    continue; // ya está; se verificó al descargarse (o lo sembró el operador)
  } catch {}

  console.log(`[pixelforge] descargando ${fichero}…`);
  const res = await fetch(`${BASE}/${fichero}`, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`[pixelforge] ${fichero}: HTTP ${res.status} — sin modelo no se arranca`);
  }
  // A un temporal del mismo directorio, con el hash calculándose en el propio
  // flujo, y rename atómico al final: nunca hay un .onnx a medias con su
  // nombre definitivo, ni aunque el proceso muera a mitad.
  const temporal = `${ruta}.descarga`;
  const hash = createHash("sha256");
  const cuerpo = Readable.fromWeb(res.body);
  cuerpo.on("data", (trozo) => hash.update(trozo));
  await pipeline(cuerpo, createWriteStream(temporal, { mode: 0o600 }));
  const visto = hash.digest("hex");
  if (visto !== sha256) {
    await unlink(temporal);
    throw new Error(
      `[pixelforge] ${fichero}: sha256 ${visto}, esperado ${sha256} — el origen no sirve el modelo auditado; no se arranca`
    );
  }
  await rename(temporal, ruta);
  console.log(`[pixelforge] ${fichero} verificado.`);
}

await import("../server.js");
