import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/** The game server serves the static export (out/) under this path; src/lib/paths.ts reads it back. */
const BASE_PATH = "/app";

/** Development only: `/api/*` is proxied to the game server (rewrites are not part of a static export). */
const GAME_SERVER = process.env.GAME_SERVER ?? "http://127.0.0.1:8000";

export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    basePath: BASE_PATH,
    trailingSlash: true,
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
    allowedDevOrigins: ["vps-worker.taild24189.ts.net"],
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
    ...(dev
      ? {
          // No `/api/status` -> `/api/status/` redirect in development: the proxied API has no trailing slashes.
          skipTrailingSlashRedirect: true,
          async rewrites() {
            return [{ source: "/api/:path*", destination: `${GAME_SERVER}/api/:path*`, basePath: false }];
          },
        }
      : { output: "export" }),
  };
}
