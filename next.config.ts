import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Client cache, in browser memory only: going back to a page within a minute reuses what was loaded
    // instead of asking the server again. Any save or delete purges it (revalidatePath in lib/actions/run.ts),
    // and signing out does a full page load, so nothing outlives the session.
    staleTimes: { dynamic: 60, static: 300 },
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale, or fixes can't reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
