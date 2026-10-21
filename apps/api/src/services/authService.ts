import type { AuthUser, TeamMember } from "@team-dashboard/shared";
import {
  createSession,
  deleteExpiredSessions,
  deleteSessionByTokenHash,
  getSessionByTokenHash,
} from "../db/auth";
import {
  addMember,
  getActiveMemberByEmail,
  getMemberByEmail,
  getMemberById,
  getPasswordHash,
  listMemberIdsMissingPassword,
  setPasswordHash,
} from "../db/members";
import {
  addDaysIso,
  getAdminEmail,
  getDefaultPassword,
  getSessionTtlDays,
  isExpired,
  resolveAuthRole,
} from "../lib/authConfig";
import {
  generateSessionToken,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from "../lib/authCrypto";
import { createLogger } from "../lib/logger";

const log = createLogger("auth");

export type LoginResult =
  | { ok: true; token: string; user: AuthUser }
  | { ok: false; status: 400 | 401; error: string };

function toAuthUser(member: TeamMember): AuthUser {
  const email = member.email!;
  return {
    id: member.id,
    name: member.name,
    email,
    role: resolveAuthRole(email),
  };
}

function adminDisplayName(email: string): string {
  const local = email.split("@")[0] ?? "admin";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Admin";
}

function expiresAtIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function assignDefaultPassword(memberId: number): Promise<void> {
  const hash = await hashPassword(getDefaultPassword());
  await setPasswordHash(memberId, hash);
}

export async function assignDefaultPasswordIfMissing(memberId: number): Promise<void> {
  if (await getPasswordHash(memberId)) {
    return;
  }
  await assignDefaultPassword(memberId);
}

export async function setMemberPassword(memberId: number, password: string): Promise<void> {
  const trimmed = password.trim();
  if (trimmed.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  const member = await getMemberById(memberId);
  if (!member) {
    throw new Error("Member not found");
  }
  const hash = await hashPassword(trimmed);
  await setPasswordHash(memberId, hash);
}

export async function changeMemberPassword(
  memberId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const current = currentPassword.trim();
  const next = newPassword.trim();
  if (!current) {
    throw new Error("Current password is required");
  }
  if (next.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwordHash = await getPasswordHash(memberId);
  if (!passwordHash || !(await verifyPassword(current, passwordHash))) {
    throw new Error("Current password is incorrect");
  }

  await setMemberPassword(memberId, next);
}

export async function ensureAdminMember(): Promise<void> {
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    log.warn("AUTH_ADMIN_EMAIL is not set; no admin user will be seeded");
    return;
  }

  let member = await getMemberByEmail(adminEmail);
  if (!member) {
    member = await addMember(adminDisplayName(adminEmail), adminEmail);
    log.info(`created admin member ${member.id} (${adminEmail})`);
  } else if (!member.active) {
    member = await addMember(member.name, adminEmail);
    log.info(`reactivated admin member ${member.id}`);
  }

  await assignDefaultPasswordIfMissing(member.id);
}

export async function backfillMissingPasswords(): Promise<void> {
  const ids = await listMemberIdsMissingPassword();
  for (const id of ids) {
    await assignDefaultPassword(id);
  }
  if (ids.length > 0) {
    log.info(`assigned default password to ${ids.length} member(s)`);
  }
}

export async function loginWithPassword(emailRaw: string, passwordRaw: string): Promise<LoginResult> {
  await deleteExpiredSessions();

  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();

  if (!email || !email.includes("@") || !password) {
    return { ok: false, status: 400, error: "Email and password are required" };
  }

  const member = await getActiveMemberByEmail(email);
  if (!member?.email) {
    return { ok: false, status: 401, error: "Invalid email or password" };
  }

  let passwordHash = await getPasswordHash(member.id);
  if (!passwordHash) {
    await assignDefaultPassword(member.id);
    passwordHash = await getPasswordHash(member.id);
  }

  if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
    return { ok: false, status: 401, error: "Invalid email or password" };
  }

  const token = generateSessionToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = addDaysIso(getSessionTtlDays());
  await createSession(tokenHash, member.id, member.email, expiresAt);

  return { ok: true, token, user: toAuthUser(member) };
}

export async function getUserFromSessionToken(
  token: string | undefined | null,
): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  await deleteExpiredSessions();

  const tokenHash = sha256Hex(token);
  const session = await getSessionByTokenHash(tokenHash);
  if (!session || isExpired(expiresAtIso(session.expires_at))) {
    if (session) {
      await deleteSessionByTokenHash(tokenHash);
    }
    return null;
  }

  const member = await getMemberById(session.member_id);
  if (!member?.active || !member.email) {
    await deleteSessionByTokenHash(tokenHash);
    return null;
  }

  return toAuthUser(member);
}

export async function logoutSession(token: string | undefined | null): Promise<void> {
  if (!token) {
    return;
  }
  await deleteSessionByTokenHash(sha256Hex(token));
}
