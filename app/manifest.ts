import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/pwa/icon";

/**
 * Bump when a maskable icon's artwork changes. Browsers and the service worker cache icons by URL, and an
 * installed app only picks up a new icon when the URL in the manifest changes: v1 had the NEXA wordmark
 * running off the bottom edge, which Android's launch screen clipped.
 */
const MASKABLE_VERSION = 2;

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: "Finance, vehicle, projects, nutrition and fitness in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // Ordered fallbacks for browsers that don't do standalone.
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    background_color: BRAND.night,
    theme_color: BRAND.night,
    // A link into the app reuses the window that is already open instead of spawning a second one.
    launch_handler: { client_mode: "navigate-existing" },
    categories: ["finance", "health", "lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable: the mark sits inside the centre 80% so Android's icon shapes don't clip it.
      { src: `/icons/maskable-192.png?v=${MASKABLE_VERSION}`, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: `/icons/maskable-512.png?v=${MASKABLE_VERSION}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
