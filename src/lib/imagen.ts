/**
 * Si lo que han subido parece siquiera una imagen.
 *
 * La comprobación que había miraba el tipo declarado o el nombre del fichero, y
 * las dos cosas las escribe quien sube. Cualquier cosa llamada `x.png` llegaba
 * hasta PIL, PIL no la sabía abrir, y la ruta contestaba 500. Medido: doce
 * ficheros distintos —texto, HTML, un SVG, cero bytes, un PNG cortado, un ZIP—
 * daban 500 los doce, y en quitar fondo cada uno costaba arrancar un Python
 * entero, 1,3 segundos, para acabar en un error.
 *
 * Un fichero que no es una imagen es un error de quien lo manda: eso es un 400.
 * Y mirando los primeros bytes se descarta aquí, sin gastar un proceso.
 *
 * Esto no sustituye a que PIL lo abra de verdad —una firma correcta no garantiza
 * que el resto esté bien, un PNG cortado por la mitad empieza igual que uno
 * entero—. Es el filtro barato; el caro sigue detrás.
 */
const FIRMAS: Array<{ nombre: string; bytes: number[]; desde?: number }> = [
  { nombre: "PNG", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { nombre: "JPEG", bytes: [0xff, 0xd8, 0xff] },
  { nombre: "GIF", bytes: [0x47, 0x49, 0x46, 0x38] },
  { nombre: "BMP", bytes: [0x42, 0x4d] },
  // TIFF, en sus dos ordenaciones de bytes.
  { nombre: "TIFF-LE", bytes: [0x49, 0x49, 0x2a, 0x00] },
  { nombre: "TIFF-BE", bytes: [0x4d, 0x4d, 0x00, 0x2a] },
];

export function pareceImagen(datos: Buffer): boolean {
  if (datos.length < 12) return false;

  for (const { bytes, desde = 0 } of FIRMAS) {
    if (bytes.every((b, i) => datos[desde + i] === b)) return true;
  }

  // WebP no tiene una firma seguida: son "RIFF", cuatro bytes de tamaño, y
  // "WEBP". Por eso va aparte y no en la tabla.
  if (datos.toString("ascii", 0, 4) === "RIFF" && datos.toString("ascii", 8, 12) === "WEBP") {
    return true;
  }

  return false;
}

/**
 * El presupuesto de píxeles, para poder decirlo en el mensaje de error.
 *
 * Lo aplica el proceso de Python, que es quien puede mirar la cabecera de la
 * imagen sin descodificarla. Se lee aquí también porque el mensaje llevaba el
 * número escrito a pelo, y en cuanto alguien cambiase la variable el mensaje
 * habría empezado a mentir.
 */
export const MAX_PIXELS = Number(process.env.PIXELFORGE_MAX_PIXELS || 40_000_000);

export const megapixeles = () => Math.round(MAX_PIXELS / 1_000_000);
