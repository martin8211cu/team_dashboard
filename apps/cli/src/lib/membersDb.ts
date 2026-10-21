import { getDb } from "@team-dashboard/db";

export async function getActiveMemberNamesFromDb(): Promise<string[]> {
  const members = await getActiveMembersFromDb();
  return members.map((member) => member.name);
}

export async function getActiveMembersFromDb(): Promise<
  Array<{
    name: string;
    email: string | null;
    jiraAccountId: string | null;
  }>
> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required (set it in .env at the project root)");
  }

  const rows = await getDb()("team_members")
    .where({ active: true })
    .select<{ name: string; email: string | null; jira_account_id: string | null }[]>(
      "name",
      "email",
      "jira_account_id",
    )
    .orderByRaw("lower(name)");

  return rows.map((row) => ({
    name: row.name,
    email: row.email,
    jiraAccountId: row.jira_account_id,
  }));
}
