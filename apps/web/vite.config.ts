import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  resolve: {
    conditions: ["browser", "module", "import", "default"],
  },
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8090",
        changeOrigin: true,
        timeout: 300_000,
        proxyTimeout: 300_000,
      },
      "/health": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
    },
  },
});
