/** Where the dashboard, its assets and the game server live.
 *
 * The static export is served by the game server under BASE_PATH (next.config.ts sets the same value, and
 * `next/link` prefixes it for pages), so plain `<img>` and `<video>` sources go through `asset()`. The API and the
 * WebSocket share the page's origin; in development NEXT_PUBLIC_GAME_WS points the socket (and the phone link) at
 * the game server while `/api/*` goes through the dev proxy. */

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

/** A file under public/ as the browser must request it. */
export function asset(path: string) {
  return `${BASE_PATH}${path}`
}

const GAME_WS = process.env.NEXT_PUBLIC_GAME_WS?.replace(/\/$/, "") ?? ""

/** The game server's HTTP origin: the page's own, or the host NEXT_PUBLIC_GAME_WS names in development. */
export function gameOrigin() {
  if (GAME_WS) return GAME_WS.replace(/^ws(s?):/, "http$1:")
  if (typeof window === "undefined") return ""
  return window.location.origin
}

/** A WebSocket URL on the game server for a path such as `/ws/game`. */
export function wsUrl(path: string) {
  if (GAME_WS) return `${GAME_WS}${path}`
  const secure = window.location.protocol === "https:"
  return `${secure ? "wss" : "ws"}://${window.location.host}${path}`
}

/** True when the dashboard is opened by an address a phone could not reach. */
export function isLocalHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"].includes(hostname)
}
