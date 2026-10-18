import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["vps-worker.taild24189.ts.net"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
