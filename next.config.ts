import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Answer artwork only ever comes from Wikimedia Commons files — the same
    // hosts and path prefix isCommonsFile() enforces server-side. Scaled
    // thumbnails are served from thumb., originals from upload.
    remotePatterns: [
      new URL("https://thumb.wikimedia.org/wikipedia/commons/**"),
      new URL("https://upload.wikimedia.org/wikipedia/commons/**"),
    ],
  },
};

export default nextConfig;
