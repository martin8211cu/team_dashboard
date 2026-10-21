import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const devApiTarget = env.VITE_DEV_API_URL?.trim() || "http://localhost:8090";

  return {
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
          target: devApiTarget,
          changeOrigin: true,
          timeout: 300_000,
          proxyTimeout: 300_000,
        },
        "/health": {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
