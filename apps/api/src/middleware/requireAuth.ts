import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AuthUser } from "@team-dashboard/shared";
import { AUTH_COOKIE_NAME } from "../lib/authConfig";
import { getUserFromSessionToken } from "../services/authService";

export type AuthVariables = {
  user: AuthUser;
};

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  const user = await getUserFromSessionToken(token);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);
  await next();
};
