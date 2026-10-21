import { getDb } from "@team-dashboard/db";

export type AuthSessionRow = {
  id: number;
  token_hash: string;
  member_id: number;
  email: string;
  expires_at: Date | string;
  created_at: Date | string;
};

export async function createSession(
  tokenHash: string,
  memberId: number,
  email: string,
  expiresAtIso: string,
): Promise<void> {
  await getDb()("auth_sessions").insert({
    token_hash: tokenHash,
    member_id: memberId,
    email,
    expires_at: expiresAtIso,
  });
}

export async function getSessionByTokenHash(tokenHash: string): Promise<AuthSessionRow | null> {
  const row = await getDb()("auth_sessions")
    .where({ token_hash: tokenHash })
    .first<AuthSessionRow>();
  return row ?? null;
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  await getDb()("auth_sessions").where({ token_hash: tokenHash }).del();
}

export async function deleteExpiredSessions(): Promise<void> {
  const now = new Date().toISOString();
  await getDb()("auth_sessions").where("expires_at", "<", now).del();
}
