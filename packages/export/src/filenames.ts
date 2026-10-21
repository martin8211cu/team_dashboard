function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Status: team-only has no suffix; all sprint tickets uses `-all`. */
export function sprintMetricsFilename(sprintNumber: number, teamOnly: boolean): string {
  const suffix = teamOnly ? "" : "-all";
  return `sprint-${sprintNumber}-metrics${suffix}-${todayStamp()}.xlsx`;
}

export function sprintFilename(sprintNumber: number, teamOnly: boolean): string {
  const suffix = teamOnly ? "" : "-all";
  return `sprint-${sprintNumber}${suffix}-${todayStamp()}.xlsx`;
}

export function sprintTasksFilename(sprintNumber: number, teamOnly: boolean): string {
  const suffix = teamOnly ? "" : "-all";
  return `sprint-${sprintNumber}-tasks${suffix}-${todayStamp()}.xlsx`;
}

export function sprintTasksCompareFilename(sprintNumbers: number[], teamOnly: boolean): string {
  const suffix = teamOnly ? "" : "-all";
  const list = [...sprintNumbers].sort((a, b) => b - a).join("-");
  return `sprint-tasks-${list}${suffix}-${todayStamp()}.xlsx`;
}

export function tasksStatusFilename(): string {
  return `alten-jira-status-${todayStamp()}.xlsx`;
}
