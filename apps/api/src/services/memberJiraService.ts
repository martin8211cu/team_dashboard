import type { AssigneeIdentifier, JiraUser } from "@team-dashboard/shared";
import { listMembers, setMemberJiraAccount, upsertMemberFromJira } from "../db/members";
import { createJiraClientFromEnv, isJiraConfigured } from "../lib/jiraClient";
import { createLogger } from "../lib/logger";

const log = createLogger("jira");

export async function searchJiraUsers(query: string): Promise<JiraUser[]> {
  if (!isJiraConfigured()) {
    throw new Error("Jira not configured");
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new Error("Query must be at least 2 characters");
  }

  const client = createJiraClientFromEnv();
  return client.searchUsers(trimmed);
}

export async function addMemberFromJiraUser(user: JiraUser) {
  return upsertMemberFromJira({
    displayName: user.displayName,
    email: user.emailAddress,
    jiraAccountId: user.accountId,
  });
}

export async function resolveAssigneesForJql(): Promise<AssigneeIdentifier[]> {
  const members = await listMembers({ activeOnly: true });
  const assignees: AssigneeIdentifier[] = [];

  let client: ReturnType<typeof createJiraClientFromEnv> | null = null;

  for (const member of members) {
    if (member.jiraAccountId) {
      assignees.push({
        name: member.name,
        email: member.email,
        jiraAccountId: member.jiraAccountId,
      });
      continue;
    }

    if (member.email && isJiraConfigured()) {
      client ??= createJiraClientFromEnv();
      try {
        const user = await client.findUserByEmail(member.email);
        if (user) {
          await setMemberJiraAccount(member.id, user.accountId, user.displayName);
          assignees.push({
            name: user.displayName,
            email: member.email,
            jiraAccountId: user.accountId,
          });
          continue;
        }
      } catch (err) {
        log.warn(`could not resolve ${member.email}:`, err);
      }
    }

    assignees.push({
      name: member.name,
      email: member.email,
      jiraAccountId: member.jiraAccountId,
    });
  }

  return assignees;
}

export async function resolveMemberInJira(memberId: number) {
  if (!isJiraConfigured()) {
    throw new Error("Jira not configured");
  }

  const members = await listMembers();
  const member = members.find((m) => m.id === memberId);
  if (!member) {
    throw new Error("Member not found");
  }

  if (!member.email) {
    throw new Error("Member has no email to resolve in Jira");
  }

  const client = createJiraClientFromEnv();
  const user = await client.findUserByEmail(member.email);

  if (!user) {
    throw new Error(`No Jira user found for ${member.email}`);
  }

  return setMemberJiraAccount(member.id, user.accountId, user.displayName);
}
