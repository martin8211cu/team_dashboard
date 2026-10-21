import type { SprintListItem } from "../types/jira";

export function filterSprintsFromMin(
  sprints: SprintListItem[],
  minSprintNumber?: number,
): SprintListItem[] {
  if (minSprintNumber == null) {
    return sprints;
  }
  return sprints.filter((sprint) => sprint.number != null && sprint.number >= minSprintNumber);
}
