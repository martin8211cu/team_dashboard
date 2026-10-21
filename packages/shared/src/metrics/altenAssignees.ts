import type { AssigneeIdentifier } from "../types/member";

export type AltenMemberRef = {
  name: string;
  email?: string | null;
  aliases?: string[];
};

function normalizeAssigneeKey(value: string): string {
  return value.trim().toLowerCase();
}

function emailLocalPart(email: string): string | null {
  const local = email.split("@")[0]?.trim();
  return local ? normalizeAssigneeKey(local) : null;
}

export function toAltenMemberRefs(members: AltenMemberRef[] | string[]): AltenMemberRef[] {
  if (members.length === 0) {
    return [];
  }

  if (typeof members[0] === "string") {
    return (members as string[]).map((name) => ({ name }));
  }

  return members as AltenMemberRef[];
}

export function buildAltenMemberRefs(
  members: Array<{ name: string; email?: string | null; jiraAccountId?: string | null }>,
  resolvedAssignees: AssigneeIdentifier[] = [],
): AltenMemberRef[] {
  return members.map((member) => {
    const resolved = resolvedAssignees.find(
      (assignee) =>
        (member.jiraAccountId && assignee.jiraAccountId === member.jiraAccountId) ||
        (member.email &&
          assignee.email &&
          assignee.email.toLowerCase() === member.email.toLowerCase()),
    );

    const aliases = new Set<string>();
    if (member.email) {
      const local = emailLocalPart(member.email);
      if (local) {
        aliases.add(local);
      }
    }
    if (resolved?.name && resolved.name !== member.name) {
      aliases.add(resolved.name);
    }

    return {
      name: member.name,
      email: member.email,
      aliases: aliases.size > 0 ? [...aliases] : undefined,
    };
  });
}

export function buildAltenMemberAliasMap(refs: AltenMemberRef[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const ref of refs) {
    map.set(normalizeAssigneeKey(ref.name), ref.name);
    if (ref.email) {
      map.set(normalizeAssigneeKey(ref.email), ref.name);
      const local = emailLocalPart(ref.email);
      if (local) {
        map.set(local, ref.name);
      }
    }
    for (const alias of ref.aliases ?? []) {
      map.set(normalizeAssigneeKey(alias), ref.name);
    }
  }

  return map;
}

export function resolveAltenMemberName(
  label: string | null | undefined,
  aliasMap: Map<string, string>,
): string | null {
  if (!label || label === "Unassigned") {
    return null;
  }

  return aliasMap.get(normalizeAssigneeKey(label)) ?? null;
}

export function parseAltenAssignees(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function normalizeMemberNames(memberNames: string[]): Set<string> {
  return new Set(
    memberNames.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0),
  );
}

export function matchesTeamMembers({
  altenAssignees,
  memberNames,
}: {
  altenAssignees: string | null | undefined;
  memberNames: string[];
}): boolean {
  const names = normalizeMemberNames(memberNames);
  if (names.size === 0) {
    return true;
  }

  const assignees = parseAltenAssignees(altenAssignees);
  return assignees.some((name) => names.has(name.toLowerCase()));
}

export function accumulateByAltenAssignees(
  assigneeMap: Map<string, number>,
  altenAssignees: string | null | undefined,
  countMembers?: string[],
): void {
  const memberFilter =
    countMembers && countMembers.length > 0 ? normalizeMemberNames(countMembers) : null;

  for (const name of parseAltenAssignees(altenAssignees)) {
    if (memberFilter && !memberFilter.has(name.toLowerCase())) {
      continue;
    }
    assigneeMap.set(name, (assigneeMap.get(name) ?? 0) + 1);
  }
}

export function formatAltenAssignees(names: string[] | null): string | null {
  if (!names || names.length === 0) {
    return null;
  }
  return names.join(", ");
}
