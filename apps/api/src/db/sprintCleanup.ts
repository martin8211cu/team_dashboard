import { getDb } from "@team-dashboard/db";

export async function deleteSprintSnapshotsBelow(minSprintNumber: number): Promise<{
  taskSnapshots: number;
  metricsSnapshots: number;
}> {
  const taskSnapshots = await getDb()("sprint_task_snapshots")
    .where("sprint_number", "<", minSprintNumber)
    .del();
  const metricsSnapshots = await getDb()("sprint_metrics_snapshots")
    .where("sprint_number", "<", minSprintNumber)
    .del();
  return { taskSnapshots, metricsSnapshots };
}
