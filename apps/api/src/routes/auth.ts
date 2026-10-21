import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AuthMeResponse, AuthUser, LoginResponse } from "@team-dashboard/shared";
import {
  AUTH_COOKIE_NAME,
  getSessionCookieOptions,
  getSessionTtlDays,
} from "../lib/authConfig";
import { requireAuth } from "../middleware/requireAuth";
import {
  getUserFromSessionToken,
  loginWithPassword,
  logoutSession,
  setMemberPassword,
} from "../services/authService";

type AuthRouteEnv = {
  Variables: {
    user: AuthUser;
  };
};

export const authRoutes = new Hono<AuthRouteEnv>();

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string): void {
  const maxAge = getSessionTtlDays() * 24 * 60 * 60;
  const { sameSite, secure } = getSessionCookieOptions();
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
    maxAge,
  });
}

function clearSessionCookie(c: Parameters<typeof deleteCookie>[0]): void {
  const { sameSite, secure } = getSessionCookieOptions();
  deleteCookie(c, AUTH_COOKIE_NAME, {
    path: "/",
    secure,
    sameSite,
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

authRoutes.patch("/password", requireAuth, async (c) => {
  const user = c.get("user") as AuthUser;
  const body = (await c.req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  try {
    await setMemberPassword(user.id, password);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update password";
    const status = message.includes("not found") ? 404 : 400;
    return c.json({ error: message }, status);
  }
});
