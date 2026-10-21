import type { AssigneeIdentifier } from "../types/member";

function formatAssigneeForJql(ref: AssigneeIdentifier): string {
  if (ref.jiraAccountId) {
    return ref.jiraAccountId;
  }
  return `"${ref.name.replace(/"/g, '\\"')}"`;
}

function quoteAssignees(assignees: AssigneeIdentifier[]): string {
  return assignees.map(formatAssigneeForJql).join(", ");
}

export function buildJql(project: string, assignees: AssigneeIdentifier[]): string {
  const filters = [`project = ${project}`, `assignee was in (${quoteAssignees(assignees)})`].join(" AND ");
  return `${filters} ORDER BY assignee ASC, status ASC, key ASC`;
}

export function buildSprintJql(project: string, assignees: AssigneeIdentifier[]): string {
  const filters = [
    `project = ${project}`,
    `assignee was in (${quoteAssignees(assignees)})`,
    "Sprint in openSprints()",
  ].join(" AND ");

  return `${filters} ORDER BY assignee ASC, status ASC, key ASC`;
}

export function buildSprintName(project: string, sprintNumber: number | string): string {
  return `${project} Sprint ${sprintNumber}`;
}

export function parseSprintNumber(name: string, project: string): number | null {
  const prefix = `${project} Sprint `;
  if (!name.startsWith(prefix)) {
    return null;
  }
  const num = Number.parseInt(name.slice(prefix.length), 10);
  return Number.isNaN(num) ? null : num;
}

export function buildSprintJqlByNumber(
  project: string,
  assignees: AssigneeIdentifier[],
  sprintNumber: number | string,
  { allTickets = false }: { allTickets?: boolean } = {},
): string {
  const sprintName = buildSprintName(project, sprintNumber);
  const filters = [`project = ${project}`, `Sprint = "${sprintName.replace(/"/g, '\\"')}"`];

  if (!allTickets) {
    filters.push(`assignee was in (${quoteAssignees(assignees)})`);
  }

  return `${filters.join(" AND ")} ORDER BY assignee ASC, status ASC, key ASC`;
}

export function buildEpicsJql(
  project: string,
  { summaryContains }: { summaryContains?: string } = {},
): string {
  const filters = [`project = ${project}`, "issuetype = Epic"];

  const needle = summaryContains?.trim();
  if (needle) {
    filters.push(`summary ~ "${needle.replace(/"/g, '\\"')}"`);
  }

  return `${filters.join(" AND ")} ORDER BY key ASC`;
}

/** @deprecated Use AssigneeIdentifier[] — kept for CLI compatibility */
export function buildJqlByNames(project: string, members: string[]): string {
  return buildJql(
    project,
    members.map((name) => ({ name })),
  );
}
