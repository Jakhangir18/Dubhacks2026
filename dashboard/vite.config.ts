import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: the dashboard runs on :5173 and forwards /api to the game server (uvicorn on :8000).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
