import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: the dashboard runs on :5173 and forwards /api to the game server (uvicorn on :8000).
// base "./": the build also works when the game server serves it at /dashboard/.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
