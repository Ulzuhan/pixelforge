import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase max request body size for image uploads (needed for API routes)
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Add custom headers to prevent aggressive caching by Cloudflare
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;