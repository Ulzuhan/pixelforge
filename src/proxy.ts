import { NextResponse } from "next/server";

/**
 * Antes esto era `src/middleware.ts`. Next 16 deprecó ese nombre en favor de
 * `proxy`, y el build lo avisaba en cada compilación.
 *
 * Su único trabajo es de caché: impedir que el borde sirva HTML o respuestas de
 * API antiguas. Los ficheros de `_next/static` no pasan por aquí —el `matcher`
 * los excluye— así que la rama que los trataba era código muerto: no se
 * ejecutaba nunca. Next ya los sirve como inmutables por su cuenta.
 */
export function proxy() {
  const response = NextResponse.next();

  // Páginas y rutas de API: nada de caché, ni en el navegador ni en el borde.
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  // Lo que sale de aquí son imágenes y un SVG, y un SVG que el navegador decida
  // tratar como documento es otra cosa muy distinta a una imagen. La CSP y el
  // X-Frame-Options los pone Cloudflare en el borde, pero esta no la ponía nadie
  // —ni la aplicación ni la regla de transformación—, así que va aquí.
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Sin estas, Cloudflare interpreta las marcas de ISR de Next y cachea igual.
  response.headers.delete("x-nextjs-cache");
  response.headers.delete("x-nextjs-prerender");
  response.headers.delete("x-nextjs-stale-time");

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo salvo:
     * - _next/static  (ficheros estáticos, ya inmutables)
     * - _next/image   (optimización de imágenes)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
