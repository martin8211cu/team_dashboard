import type { MiddlewareHandler } from "hono";
import type { AuthUser } from "@team-dashboard/shared";

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get("user") as AuthUser | undefined;

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (user.role !== "admin") {
    return c.json({ error: "Forbidden", message: "Admin role required" }, 403);
  }

  await next();
};
