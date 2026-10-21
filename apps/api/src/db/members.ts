import type { TeamMember } from "@team-dashboard/shared";
import { getDb } from "@team-dashboard/db";

export type TeamMemberRow = {
  id: number;
  name: string;
  email: string | null;
  jira_account_id: string | null;
  password_hash: string | null;
  active: boolean;
  created_at: Date | string;
};

function normalizeEmail(email?: string | null): string | null {
  if (!email) {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function rowToMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    jiraAccountId: row.jira_account_id,
    active: row.active,
    createdAt: toIso(row.created_at),
  };
}

export async function listMembers(
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<TeamMember[]> {
  let query = getDb()("team_members").select<TeamMemberRow[]>("*").orderByRaw("lower(name)");
  if (activeOnly) {
    query = query.where({ active: true });
  }
  const rows = await query;
  return rows.map(rowToMember);
}

export async function getMemberById(id: number): Promise<TeamMember | null> {
  const row = await getDb()("team_members").where({ id }).first<TeamMemberRow>();
  return row ? rowToMember(row) : null;
}

export async function getActiveMemberByEmail(email: string): Promise<TeamMember | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const row = await getDb()("team_members")
    .where({ email: normalized, active: true })
    .first<TeamMemberRow>();

  return row ? rowToMember(row) : null;
}

export async function getMemberByEmail(email: string): Promise<TeamMember | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const row = await getDb()("team_members").where({ email: normalized }).first<TeamMemberRow>();
  return row ? rowToMember(row) : null;
}

export async function getPasswordHash(memberId: number): Promise<string | null> {
  const row = await getDb()("team_members")
    .where({ id: memberId })
    .select("password_hash")
    .first<{ password_hash: string | null }>();
  return row?.password_hash ?? null;
}

export async function setPasswordHash(memberId: number, passwordHash: string): Promise<void> {
  const count = await getDb()("team_members")
    .where({ id: memberId })
    .update({ password_hash: passwordHash });
  if (count === 0) {
    throw new Error("Member not found");
  }
}

export async function listMemberIdsMissingPassword(): Promise<number[]> {
  const rows = await getDb()("team_members")
    .whereNull("password_hash")
    .orWhere("password_hash", "")
    .select<{ id: number }[]>("id");
  return rows.map((row) => row.id);
}

export async function getActiveMemberNames(): Promise<string[]> {
  const members = await listMembers({ activeOnly: true });
  return members.map((m) => m.name);
}

export async function addMember(name: string, email?: string | null): Promise<TeamMember> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Member name is required");
  }

  const normalizedEmail = normalizeEmail(email);

  const existing = await getDb()("team_members")
    .whereRaw("lower(name) = lower(?)", [trimmed])
    .first<TeamMemberRow>();

  if (existing) {
    if (!existing.active) {
      const emailChanged = normalizedEmail && normalizedEmail !== existing.email;
      await getDb()("team_members")
        .where({ id: existing.id })
        .update({
          active: true,
          email: normalizedEmail ?? existing.email,
          ...(emailChanged ? { jira_account_id: null } : {}),
        });
      return (await getMemberById(existing.id))!;
    }
    throw new Error(`Member already exists: ${trimmed}`);
  }

  if (normalizedEmail) {
    const emailTaken = await getDb()("team_members")
      .where({ email: normalizedEmail })
      .first<TeamMemberRow>();
    if (emailTaken) {
      throw new Error(`Email already in use: ${normalizedEmail}`);
    }
  }

  const [inserted] = await getDb()("team_members")
    .insert({ name: trimmed, email: normalizedEmail })
    .returning<TeamMemberRow[]>("*");

  return rowToMember(inserted!);
}

export async function updateMember(
  id: number,
  input: { name?: string; email?: string | null },
): Promise<TeamMember> {
  const row = await getDb()("team_members").where({ id }).first<TeamMemberRow>();
  if (!row) {
    throw new Error("Member not found");
  }

  const name = input.name?.trim() ?? row.name;
  const email = input.email !== undefined ? normalizeEmail(input.email) : row.email;

  if (!name) {
    throw new Error("Member name is required");
  }

  if (email) {
    const emailTaken = await getDb()("team_members")
      .where({ email })
      .whereNot({ id })
      .first<TeamMemberRow>();
    if (emailTaken) {
      throw new Error(`Email already in use: ${email}`);
    }
  }

  const emailChanged = input.email !== undefined && email !== row.email;

  if (emailChanged) {
    await getDb()("team_members")
      .where({ id })
      .update({ name, email, jira_account_id: null });
  } else {
    await getDb()("team_members").where({ id }).update({ name });
  }

  return (await getMemberById(id))!;
}

export async function upsertMemberFromJira(input: {
  displayName: string;
  email?: string | null;
  jiraAccountId: string;
}): Promise<TeamMember> {
  const name = input.displayName.trim();
  const email = normalizeEmail(input.email);
  const jiraAccountId = input.jiraAccountId.trim();

  if (!name || !jiraAccountId) {
    throw new Error("displayName and jiraAccountId are required");
  }

  const byAccount = await getDb()("team_members")
    .where({ jira_account_id: jiraAccountId })
    .first<TeamMemberRow>();

  const byEmail = email
    ? await getDb()("team_members").where({ email }).first<TeamMemberRow>()
    : null;

  const byName = await getDb()("team_members")
    .whereRaw("lower(name) = lower(?)", [name])
    .first<TeamMemberRow>();

  const existing = byAccount ?? byEmail ?? byName;

  if (existing) {
    await getDb()("team_members")
      .where({ id: existing.id })
      .update({ name, email, jira_account_id: jiraAccountId, active: true });
    return (await getMemberById(existing.id))!;
  }

  if (email) {
    const emailTaken = await getDb()("team_members").where({ email }).first<TeamMemberRow>();
    if (emailTaken) {
      throw new Error(`Email already in use: ${email}`);
    }
  }

  const [inserted] = await getDb()("team_members")
    .insert({ name, email, jira_account_id: jiraAccountId })
    .returning<TeamMemberRow[]>("*");

  return rowToMember(inserted!);
}

export async function setMemberJiraAccount(
  id: number,
  jiraAccountId: string,
  displayName?: string,
): Promise<TeamMember> {
  const row = await getDb()("team_members").where({ id }).first<TeamMemberRow>();
  if (!row) {
    throw new Error("Member not found");
  }

  await getDb()("team_members")
    .where({ id })
    .update({
      jira_account_id: jiraAccountId,
      ...(displayName ? { name: displayName } : {}),
    });

  return (await getMemberById(id))!;
}

export async function removeMember(id: number): Promise<void> {
  const row = await getDb()("team_members").where({ id }).first<TeamMemberRow>();
  if (!row) {
    throw new Error("Member not found");
  }

  await getDb()("team_members").where({ id }).update({ active: false });
}

export async function deleteMember(id: number): Promise<void> {
  const count = await getDb()("team_members").where({ id }).del();
  if (count === 0) {
    throw new Error("Member not found");
  }
}
