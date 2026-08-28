import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  // El directorio de trabajo nunca dentro del artefacto: son imágenes de quien
  // las sube, vivas durante una petición. Mismo criterio que TabUp y SecretDrop.
  outputFileTracingRoot: import.meta.dirname,
  outputFileTracingExcludes: { "**": ["./.pixelforge-tmp/**/*"] },
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
