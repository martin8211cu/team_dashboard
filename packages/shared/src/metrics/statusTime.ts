import type { JiraChangelogHistory, StatusChange } from "../types/jira";
import type { EpicStatusRow } from "../types/metrics";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const DEFAULT_STATUS_COLUMNS = [
  "Open",
  "POSTPONED",
  "Closed",
  "SPECIFICATION IN PROGRESS",
  "Ready for Workshop",
  "READY FOR ESTIMATION",
  "Estimated",
  "In Progress",
  "Ready for Test",
  "Test In Progress",
] as const;

function roundDays(ms: number): number {
  return Math.round((ms / MS_PER_DAY) * 100) / 100;
}

export function extractStatusChanges(changelogEntries: JiraChangelogHistory[]): StatusChange[] {
  return changelogEntries
    .flatMap((history) =>
      (history.items ?? [])
        .filter((item) => item.field === "status")
        .map((item) => ({
          at: new Date(history.created),
          from: item.fromString ?? "",
          to: item.toString ?? "",
        })),
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function computeStatusDurations({
  created,
  currentStatus,
  statusChanges,
  endAt = new Date(),
}: {
  created: string;
  currentStatus?: string;
  statusChanges: StatusChange[];
  endAt?: Date;
}): Map<string, number> {
  const durations = new Map<string, number>();
  const createdAt = new Date(created);
  const end = new Date(endAt);

  if (statusChanges.length === 0) {
    const status = currentStatus ?? "Open";
    durations.set(status, roundDays(end.getTime() - createdAt.getTime()));
    return durations;
  }

  let current = statusChanges[0].from || currentStatus || "Open";
  let segmentStart = createdAt;

  for (const change of statusChanges) {
    const elapsed = change.at.getTime() - segmentStart.getTime();
    if (elapsed > 0 && current) {
      durations.set(current, (durations.get(current) ?? 0) + elapsed);
    }
    current = change.to;
    segmentStart = change.at;
  }

  if (current) {
    const elapsed = end.getTime() - segmentStart.getTime();
    if (elapsed > 0) {
      durations.set(current, (durations.get(current) ?? 0) + elapsed);
    }
  }

  const rounded = new Map<string, number>();
  for (const [status, ms] of durations.entries()) {
    rounded.set(status, roundDays(ms));
  }

  return rounded;
}

export function buildStatusColumnOrder(
  rows: EpicStatusRow[],
  preferredColumns: readonly string[] = DEFAULT_STATUS_COLUMNS,
): string[] {
  const discovered = new Set<string>();

  for (const row of rows) {
    for (const status of row.statusDurations.keys()) {
      discovered.add(status);
    }
  }

  const ordered = preferredColumns.filter((status) => discovered.has(status));
  const extras = [...discovered]
    .filter((status) => !preferredColumns.includes(status))
    .sort((a, b) => a.localeCompare(b));

  return [...ordered, ...extras];
}

export function epicRowToValues(
  epicRow: EpicStatusRow,
  statusColumns: string[],
): Record<string, string | number> {
  const values: Record<string, string | number> = {
    epic: epicRow.key,
    title: epicRow.summary,
  };

  for (const status of statusColumns) {
    values[status] = epicRow.statusDurations.get(status) ?? "";
  }

  return values;
}
