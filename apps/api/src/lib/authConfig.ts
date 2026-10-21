import type { AuthRole } from "@team-dashboard/shared";

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME?.trim() || "td_session";

export function getAdminEmail(): string | null {
  const email = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

/** Requires AUTH_DEFAULT_PASSWORD in the environment (no hardcoded fallback). */
export function getDefaultPassword(): string {
  const value = process.env.AUTH_DEFAULT_PASSWORD;
  if (value == null || value.length === 0) {
    throw new Error(
      "AUTH_DEFAULT_PASSWORD is required. Set it in .env at the project root (see .env.example).",
    );
  }
  return value;
}

export function resolveAuthRole(email: string): AuthRole {
  const adminEmail = getAdminEmail();
  if (adminEmail && email.trim().toLowerCase() === adminEmail) {
    return "admin";
  }
  return "user";
}

export function getSessionTtlDays(): number {
  const value = Number(process.env.AUTH_SESSION_DAYS ?? 7);
  return Number.isFinite(value) && value > 0 ? value : 7;
}

export function isSecureCookie(): boolean {
  if (process.env.AUTH_COOKIE_SECURE === "true") {
    return true;
  }
  if (process.env.AUTH_COOKIE_SECURE === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

export type CookieSameSite = "Lax" | "Strict" | "None";

export function getCookieSameSite(): CookieSameSite {
  const raw = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
  if (raw === "none") {
    return "None";
  }
  if (raw === "strict") {
    return "Strict";
  }
  return "Lax";
}

export function getWebOrigin(): string {
  const origin = process.env.WEB_ORIGIN?.trim() || "http://localhost:5173";
  return origin.replace(/\/+$/, "");
}

export function getSessionCookieOptions(): { sameSite: CookieSameSite; secure: boolean } {
  const sameSite = getCookieSameSite();
  let secure = isSecureCookie();
  if (sameSite === "None" && !secure) {
    secure = true;
  }
  return { sameSite, secure };
}

export function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

export function isExpired(isoDate: string): boolean {
  return Date.parse(isoDate) <= Date.now();
}
