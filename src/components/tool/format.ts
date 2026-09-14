/**
 * Lo que hace falta para hablar de ficheros e imágenes en la interfaz:
 * tamaños, tiempos, nombres de salida y las dimensiones de lo que se carga.
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ACCEPT = "image/png,image/jpeg,image/webp,image/bmp,image/tiff";

const MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"]);
const EXTENSIONS = /\.(png|jpe?g|webp|bmp|tiff?)$/i;

export function looksLikeImage(file: File): boolean {
  return MIMES.has(file.type) || EXTENSIONS.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

export function formatSeconds(ms: number): string {
  const s = ms / 1000;
  if (s < 10) return `${s.toFixed(1)} s`;
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s - m * 60)} s`;
}

export function formatDims(width: number, height: number): string {
  return `${width.toLocaleString()} × ${height.toLocaleString()}`;
}

export function megapixels(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  return `${mp < 1 ? mp.toFixed(2) : mp.toFixed(1)} MP`;
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "image";
}

/** Las dimensiones de una imagen ya en el navegador, sin subirla a ningún sitio. */
export function imageDims(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not decode that image"));
    img.src = url;
  });
}

/** Tamaño y número de trazos de un SVG, leídos del texto. */
export function svgInfo(text: string): { width?: number; height?: number; paths: number } {
  const paths = (text.match(/<path\b/g) ?? []).length;
  const head = text.slice(0, 2000);
  const viewBox = head.match(/viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  if (viewBox) return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])), paths };
  const w = head.match(/\swidth="([\d.]+)(px)?"/);
  const h = head.match(/\sheight="([\d.]+)(px)?"/);
  if (w && h) return { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])), paths };
  return { paths };
}
