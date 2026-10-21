import { Hono } from "hono";
import type { HealthResponse } from "@team-dashboard/shared";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  const body: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  return c.json(body);
});
