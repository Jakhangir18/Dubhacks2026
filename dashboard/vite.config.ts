import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: the dashboard runs on :5173 and forwards /api and the game server's pages (the printable report, the
// therapist panel) to the game server (uvicorn on :8000).
// base "./": the build also works when the game server serves it at /dashboard/.
const GAME = "http://localhost:8000";
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { proxy: { "/api": GAME, "/report.html": GAME, "/therapist.html": GAME } },
});
