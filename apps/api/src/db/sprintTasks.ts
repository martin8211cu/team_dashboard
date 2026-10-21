import type { MappedIssue } from "@team-dashboard/shared";
import { getDb } from "@team-dashboard/db";

export type SprintTaskSnapshotRow = {
  sprint_number: number;
  sprint_id: number | null;
  sprint_name: string;
  sprint_state: string;
  task_count: number;
  fetched_at: Date | string;
  tasks_json: string;
};

export type SprintTaskSnapshotMeta = {
  sprintNumber: number;
  sprintName: string;
  sprintState: string;
  fetchedAt: string;
  taskCount: number;
};

export type SprintTaskSnapshot = SprintTaskSnapshotMeta & {
  tasks: MappedIssue[];
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function rowToSnapshot(row: SprintTaskSnapshotRow): SprintTaskSnapshot {
  return {
    sprintNumber: row.sprint_number,
    sprintName: row.sprint_name,
    sprintState: row.sprint_state,
    fetchedAt: toIso(row.fetched_at),
    taskCount: row.task_count,
    tasks: JSON.parse(row.tasks_json) as MappedIssue[],
  };
}

export async function getSnapshot(sprintNumber: number): Promise<SprintTaskSnapshot | null> {
  const row = await getDb()("sprint_task_snapshots")
    .where({ sprint_number: sprintNumber })
    .first<SprintTaskSnapshotRow>();
  return row ? rowToSnapshot(row) : null;
}

export async function hasSnapshot(sprintNumber: number): Promise<boolean> {
  return (await getSnapshot(sprintNumber)) != null;
}

export async function saveSnapshot(input: {
  sprintNumber: number;
  sprintId: number | null;
  sprintName: string;
  sprintState: string;
  tasks: MappedIssue[];
}): Promise<SprintTaskSnapshot> {
  const tasksJson = JSON.stringify(input.tasks);
  const taskCount = input.tasks.length;

  await getDb()("sprint_task_snapshots")
    .insert({
      sprint_number: input.sprintNumber,
      sprint_id: input.sprintId,
      sprint_name: input.sprintName,
      sprint_state: input.sprintState,
      task_count: taskCount,
      fetched_at: getDb().fn.now(),
      tasks_json: tasksJson,
    })
    .onConflict("sprint_number")
    .merge({
      sprint_id: input.sprintId,
      sprint_name: input.sprintName,
      sprint_state: input.sprintState,
      task_count: taskCount,
      fetched_at: getDb().fn.now(),
      tasks_json: tasksJson,
    });

  return (await getSnapshot(input.sprintNumber))!;
}

export async function listSnapshotMeta(): Promise<SprintTaskSnapshotMeta[]> {
  const rows = await getDb()("sprint_task_snapshots")
    .select<SprintTaskSnapshotRow[]>("*")
    .orderBy("sprint_number", "desc");

  return rows.map((row) => ({
    sprintNumber: row.sprint_number,
    sprintName: row.sprint_name,
    sprintState: row.sprint_state,
    fetchedAt: toIso(row.fetched_at),
    taskCount: row.task_count,
  }));
}
