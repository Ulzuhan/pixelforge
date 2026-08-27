import { NextRequest, NextResponse } from "next/server";

export const MAX_OUTPUT_BYTES = positiveInt("PIXELFORGE_MAX_OUTPUT_BYTES", 256 * 1024 * 1024, 512 * 1024 * 1024);
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD = 1024 * 1024;

export function positiveInt(name: string, fallback: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 && value <= max ? value : fallback;
}

export function sameOrigin(request: NextRequest): NextResponse | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    // `Host` y no `X-Forwarded-Host`, y la diferencia importa: la segunda la
    // escribe quien llama, y **este despliegue no la reemplaza**. Comprobado en
    // vivo contra el túnel: llega intacta a la aplicación mientras `Host` sigue
    // valiendo el nombre de verdad. Prefiriéndola, esta comprobación se salta
    // sola. `PIXELFORGE_PUBLIC_HOST` queda para un proxy que reescriba `Host`.
    const expectedHost = process.env.PIXELFORGE_PUBLIC_HOST?.trim() || request.headers.get("host");
    // El esquema sí sale de lo que reconstruye Next: cambiarlo no cruza orígenes,
    // porque haría falta un `Origin` con este mismo host.
    const expectedProto = request.nextUrl.protocol.replace(":", "");
    if (!expectedHost || new URL(origin).origin !== `${expectedProto}://${expectedHost}`) {
      return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  return null;
}

export function rejectOversizedBody(request: NextRequest): NextResponse | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0) {
    return NextResponse.json({ error: "Invalid Content-Length" }, { status: 400 });
  }
  if (length > MAX_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD) {
    return NextResponse.json({ error: "File too large. Max 50MB." }, { status: 413 });
  }
  return null;
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "direct";
}
