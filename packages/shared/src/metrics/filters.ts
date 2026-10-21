import type { MetricsRow } from "../types/metrics";
import { matchesTeamMembers } from "./altenAssignees";

export function filterMetricsByMembers(
  metrics: MetricsRow[],
  memberNames: string[],
): MetricsRow[] {
  if (memberNames.length === 0) {
    return metrics;
  }

  return metrics.filter((row) =>
    matchesTeamMembers({ altenAssignees: row.altenAssignees, memberNames }),
  );
}
