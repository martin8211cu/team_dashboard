import type { MetricsRow, SprintContext } from "@team-dashboard/shared";
import { getDb } from "@team-dashboard/db";

export type SprintMetricsSnapshotRow = {
  sprint_number: number;
  sprint_id: number | null;
  sprint_name: string;
  sprint_state: string;
  metrics_count: number;
  fetched_at: Date | string;
  sprint_json: string;
  metrics_json: string;
};

export type SprintMetricsSnapshotMeta = {
  sprintNumber: number;
  sprintName: string;
  sprintState: string;
  fetchedAt: string;
  metricsCount: number;
};

export type SprintMetricsSnapshot = SprintMetricsSnapshotMeta & {
  sprint: SprintContext;
  metrics: MetricsRow[];
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function rowToSnapshot(row: SprintMetricsSnapshotRow): SprintMetricsSnapshot {
  return {
    sprintNumber: row.sprint_number,
    sprintName: row.sprint_name,
    sprintState: row.sprint_state,
    fetchedAt: toIso(row.fetched_at),
    metricsCount: row.metrics_count,
    sprint: JSON.parse(row.sprint_json) as SprintContext,
    metrics: JSON.parse(row.metrics_json) as MetricsRow[],
  };
}

export async function getMetricsSnapshot(
  sprintNumber: number,
): Promise<SprintMetricsSnapshot | null> {
  const row = await getDb()("sprint_metrics_snapshots")
    .where({ sprint_number: sprintNumber })
    .first<SprintMetricsSnapshotRow>();
  return row ? rowToSnapshot(row) : null;
}

export async function hasMetricsSnapshot(sprintNumber: number): Promise<boolean> {
  return (await getMetricsSnapshot(sprintNumber)) != null;
}

export async function saveMetricsSnapshot(input: {
  sprintNumber: number;
  sprintId: number | null;
  sprintName: string;
  sprintState: string;
  sprint: SprintContext;
  metrics: MetricsRow[];
}): Promise<SprintMetricsSnapshot> {
  const sprintJson = JSON.stringify(input.sprint);
  const metricsJson = JSON.stringify(input.metrics);
  const metricsCount = input.metrics.length;

  await getDb()("sprint_metrics_snapshots")
    .insert({
      sprint_number: input.sprintNumber,
      sprint_id: input.sprintId,
      sprint_name: input.sprintName,
      sprint_state: input.sprintState,
      metrics_count: metricsCount,
      fetched_at: getDb().fn.now(),
      sprint_json: sprintJson,
      metrics_json: metricsJson,
    })
    .onConflict("sprint_number")
    .merge({
      sprint_id: input.sprintId,
      sprint_name: input.sprintName,
      sprint_state: input.sprintState,
      metrics_count: metricsCount,
      fetched_at: getDb().fn.now(),
      sprint_json: sprintJson,
      metrics_json: metricsJson,
    });

  return (await getMetricsSnapshot(input.sprintNumber))!;
}

export async function listMetricsSnapshotMeta(): Promise<SprintMetricsSnapshotMeta[]> {
  const rows = await getDb()("sprint_metrics_snapshots")
    .select<SprintMetricsSnapshotRow[]>("*")
    .orderBy("sprint_number", "desc");

  return rows.map((row) => ({
    sprintNumber: row.sprint_number,
    sprintName: row.sprint_name,
    sprintState: row.sprint_state,
    fetchedAt: toIso(row.fetched_at),
    metricsCount: row.metrics_count,
  }));
}
