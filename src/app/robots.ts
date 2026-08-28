import type { MetadataRoute } from "next";

/**
 * Se evalúa en cada petición, y no es opcional: estas rutas son Route Handlers
 * que Next cachea en la construcción por defecto, y la construcción ocurre en
 * CI, donde el origen público NO existe — el sitemap salía vacío y a robots le
 * faltaba su línea Sitemap. Medido antes de publicar nada.
 */
export const dynamic = "force-dynamic";

/**
 * Nothing here is addressable but the front page: images live for one request
 * and are never given a URL. Only the API is kept out.
 */
export default function robots(): MetadataRoute.Robots {
  const host = process.env.PIXELFORGE_PUBLIC_HOST?.trim();
  const base = host ? `https://${host}` : undefined;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}),
  };
}
