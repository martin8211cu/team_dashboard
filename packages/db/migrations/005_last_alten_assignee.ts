import type { Knex } from "knex";

type SnapshotRowWithJson = {
  sprint_number: number;
  tasks_json?: string;
  metrics_json?: string;
};

type AssigneeRecord = {
  assignee?: string | null;
  altenAssignees?: string | null;
};

function normalizeAssigneeKey(value: string): string {
  return value.trim().toLowerCase();
}

function emailLocalPart(email: string): string | null {
  const local = email.split("@")[0]?.trim();
  return local ? normalizeAssigneeKey(local) : null;
}

function buildAliasMap(
  members: Array<{ name: string; email?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    map.set(normalizeAssigneeKey(member.name), member.name);
    if (member.email) {
      map.set(normalizeAssigneeKey(member.email), member.name);
      const local = emailLocalPart(member.email);
      if (local) {
        map.set(local, member.name);
      }
    }
  }
  return map;
}

function resolveMemberName(
  label: string | null | undefined,
  aliasMap: Map<string, string>,
): string | null {
  if (!label || label === "Unassigned") {
    return null;
  }
  return aliasMap.get(normalizeAssigneeKey(label)) ?? null;
}

function parseAltenAssignees(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function correctAltenAssignees(
  record: AssigneeRecord,
  aliasMap: Map<string, string>,
): string | null {
  const fromAssignee = resolveMemberName(record.assignee, aliasMap);
  if (fromAssignee) {
    return fromAssignee;
  }

  const previous = parseAltenAssignees(record.altenAssignees);
  if (previous.length === 1) {
    return previous[0] ?? null;
  }

  return null;
}

function rewriteAssigneeRecords<T extends AssigneeRecord>(
  records: T[],
  aliasMap: Map<string, string>,
): T[] {
  return records.map((record) => ({
    ...record,
    altenAssignees: correctAltenAssignees(record, aliasMap),
  }));
}

export async function up(knex: Knex): Promise<void> {
  const members = await knex("team_members")
    .where({ active: true })
    .select<{ name: string; email: string | null }[]>("name", "email");
  const aliasMap = buildAliasMap(members);

  const taskRows = await knex("sprint_task_snapshots").select<SnapshotRowWithJson[]>(
    "sprint_number",
    "tasks_json",
  );

  for (const row of taskRows) {
    const tasks = JSON.parse(row.tasks_json ?? "[]") as AssigneeRecord[];
    const updated = rewriteAssigneeRecords(tasks, aliasMap);
    await knex("sprint_task_snapshots")
      .where({ sprint_number: row.sprint_number })
      .update({ tasks_json: JSON.stringify(updated) });
  }

  const metricsRows = await knex("sprint_metrics_snapshots").select<SnapshotRowWithJson[]>(
    "sprint_number",
    "metrics_json",
  );

  for (const row of metricsRows) {
    const metrics = JSON.parse(row.metrics_json ?? "[]") as AssigneeRecord[];
    const updated = rewriteAssigneeRecords(metrics, aliasMap);
    await knex("sprint_metrics_snapshots")
      .where({ sprint_number: row.sprint_number })
      .update({ metrics_json: JSON.stringify(updated) });
  }
}

export async function down(_knex: Knex): Promise<void> {
  // Irreversible data correction.
}
