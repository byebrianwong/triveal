import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Answer artwork only ever comes from Wikimedia Commons thumbnails — the
    // same host and path prefix isCommonsFile() enforces server-side.
    remotePatterns: [new URL("https://upload.wikimedia.org/wikipedia/commons/**")],
  },
};

export default nextConfig;
