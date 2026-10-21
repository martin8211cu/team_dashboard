import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AuthMeResponse, LoginResponse } from "@team-dashboard/shared";
import {
  AUTH_COOKIE_NAME,
  getSessionTtlDays,
  isSecureCookie,
} from "../lib/authConfig";
import {
  getUserFromSessionToken,
  loginWithPassword,
  logoutSession,
} from "../services/authService";

export const authRoutes = new Hono();

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string): void {
  const maxAge = getSessionTtlDays() * 24 * 60 * 60;
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: isSecureCookie(),
    maxAge,
  });
}

function clearSessionCookie(c: Parameters<typeof deleteCookie>[0]): void {
  deleteCookie(c, AUTH_COOKIE_NAME, {
    path: "/",
    secure: isSecureCookie(),
    sameSite: "Lax",
  });
}

authRoutes.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: unknown;
    password?: unknown;
  };
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  const result = await loginWithPassword(email, password);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }

  setSessionCookie(c, result.token);

  const response: LoginResponse = { ok: true, user: result.user };
  return c.json(response);
});

authRoutes.get("/me", async (c) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  const user = await getUserFromSessionToken(token);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const response: AuthMeResponse = { user };
  return c.json(response);
});

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  await logoutSession(token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});
