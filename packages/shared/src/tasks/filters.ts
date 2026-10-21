import type { MappedIssue } from "../types/jira";
import { matchesTeamMembers } from "../metrics/altenAssignees";

export function filterTasksByMembers(tasks: MappedIssue[], memberNames: string[]): MappedIssue[] {
  if (memberNames.length === 0) {
    return tasks;
  }

  return tasks.filter((task) =>
    matchesTeamMembers({ altenAssignees: task.altenAssignees, memberNames }),
  );
}
