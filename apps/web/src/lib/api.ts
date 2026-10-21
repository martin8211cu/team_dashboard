import type {
  AuthMeResponse,
  AuthUser,
  CreateRetroCardInput,
  CreateTeamMemberInput,
  HealthResponse,
  JiraConfigResponse,
  JiraErrorResponse,
  JiraUser,
  LoginResponse,
  MappedIssue,
  RetroCard,
  RetroReaction,
  RetroSessionDetail,
  RetroSessionSummary,
  SprintMetricsCompareResponse,
  SprintMetricsResponse,
  SprintLoadResponse,
  SprintTasksCompareResponse,
  SprintTasksResponse,
  SprintsResponse,
  TeamMember,
  UpdateTeamMemberInput,
} from "@team-dashboard/shared";
import { accumulateByAltenAssignees } from "@team-dashboard/shared";

export {
  summarizeSprintMetrics,
  summarizeSprintEvolution,
  type SprintMetricsSummary,
  type SprintEvolutionPoint,
} from "@team-dashboard/shared";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as JiraErrorResponse;
    throw new ApiError(body.message ?? body.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

async function downloadExport(url: string): Promise<void> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as JiraErrorResponse;
    throw new ApiError(body.message ?? body.error ?? `Export failed (${res.status})`, res.status);
  }

  const blob = await res.blob();
  const filename = parseContentDispositionFilename(res.headers.get("Content-Disposition")) ?? "export.xlsx";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function teamQuery(teamOnly: boolean): string {
  return teamOnly ? "team=true" : "team=false";
}

export async function fetchHealth(): Promise<HealthResponse> {
  return fetchJson("/health");
}

export async function fetchAuthMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as JiraErrorResponse;
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  }
  const data = (await res.json()) as AuthMeResponse;
  return data.user;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return fetchJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function setMemberPassword(id: number, password: string): Promise<void> {
  await fetchJson(`/api/members/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await fetchJson<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export async function fetchMembers(): Promise<TeamMember[]> {
  return fetchJson("/api/members");
}

export async function createMember(input: CreateTeamMemberInput): Promise<TeamMember> {
  return fetchJson("/api/members", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateMember(id: number, input: UpdateTeamMemberInput): Promise<TeamMember> {
  return fetchJson(`/api/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function searchJiraUsers(query: string): Promise<JiraUser[]> {
  const params = new URLSearchParams({ q: query });
  return fetchJson(`/api/members/search/jira?${params}`);
}

export async function addMemberFromJira(user: JiraUser): Promise<TeamMember> {
  return fetchJson("/api/members/from-jira", {
    method: "POST",
    body: JSON.stringify(user),
  });
}

export async function resolveMemberInJira(id: number): Promise<TeamMember> {
  return fetchJson(`/api/members/${id}/resolve-jira`, { method: "POST" });
}

export async function deactivateMember(id: number): Promise<void> {
  await fetchJson(`/api/members/${id}/deactivate`, { method: "PATCH" });
}

export async function deleteMember(id: number): Promise<void> {
  await fetchJson(`/api/members/${id}`, { method: "DELETE" });
}

export async function fetchJiraConfig(): Promise<JiraConfigResponse> {
  return fetchJson("/api/jira/config");
}

export async function fetchSprints(): Promise<SprintsResponse["sprints"]> {
  const data = await fetchJson<SprintsResponse>("/api/jira/sprints");
  return data.sprints;
}

export async function fetchSprintMetrics(
  sprintNumber: number,
): Promise<SprintMetricsResponse> {
  return fetchJson(`/api/jira/sprints/${sprintNumber}/metrics`);
}

export async function loadSprint(sprintNumber: number): Promise<SprintLoadResponse> {
  return fetchJson(`/api/jira/sprints/${sprintNumber}/load`, { method: "POST" });
}

export async function loadSprintMetrics(
  sprintNumber: number,
): Promise<SprintMetricsResponse> {
  const result = await loadSprint(sprintNumber);
  return result.metrics;
}

export async function loadSprintTasks(sprintNumber: number): Promise<SprintTasksResponse> {
  const result = await loadSprint(sprintNumber);
  return result.tasks;
}

export async function fetchSprintTasksCompare(
  sprintNumbers: number[],
): Promise<SprintTasksCompareResponse> {
  const params = new URLSearchParams({ sprints: sprintNumbers.join(",") });
  return fetchJson(`/api/jira/sprints/tasks/compare?${params}`);
}

export async function fetchSprintMetricsCompare(
  sprintNumbers: number[],
): Promise<SprintMetricsCompareResponse> {
  const params = new URLSearchParams({ sprints: sprintNumbers.join(",") });
  return fetchJson(`/api/jira/sprints/metrics/compare?${params}`);
}

export type TaskSummary = {
  total: number;
  open: number;
  closed: number;
  totalStoryPoints: number;
  byStatus: { status: string; count: number }[];
  byAssignee: { assignee: string; count: number }[];
};

export function summarizeTasks(
  tasks: MappedIssue[],
  countMembers?: string[],
): TaskSummary {
  const closedStatuses = new Set(["Closed", "Done", "Canceled"]);
  const statusMap = new Map<string, number>();
  const assigneeMap = new Map<string, number>();

  for (const task of tasks) {
    statusMap.set(task.status, (statusMap.get(task.status) ?? 0) + 1);
    accumulateByAltenAssignees(assigneeMap, task.altenAssignees, countMembers);
  }

  return {
    total: tasks.length,
    open: tasks.filter((task) => !closedStatuses.has(task.status)).length,
    closed: tasks.filter((task) => closedStatuses.has(task.status)).length,
    totalStoryPoints: tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0),
    byStatus: [...statusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    byAssignee: [...assigneeMap.entries()]
      .map(([assignee, count]) => ({ assignee, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function exportSprintFile(sprintNumber: number, teamOnly = true): Promise<void> {
  return downloadExport(`/api/export/sprints/${sprintNumber}?${teamQuery(teamOnly)}`);
}

export function exportSprintMetricsFile(sprintNumber: number, teamOnly = true): Promise<void> {
  return downloadExport(`/api/export/sprints/${sprintNumber}/metrics?${teamQuery(teamOnly)}`);
}

export function exportSprintTasksFile(sprintNumber: number, teamOnly = true): Promise<void> {
  return downloadExport(`/api/export/sprints/${sprintNumber}/tasks?${teamQuery(teamOnly)}`);
}

export function exportSprintTasksCompareFile(
  sprintNumbers: number[],
  teamOnly = true,
): Promise<void> {
  const list = sprintNumbers.join(",");
  return downloadExport(
    `/api/export/sprints/tasks/compare?sprints=${list}&${teamQuery(teamOnly)}`,
  );
}

export function exportTasksStatusFile(): Promise<void> {
  return downloadExport("/api/export/tasks/status");
}

export async function fetchRetroSessions(): Promise<RetroSessionSummary[]> {
  return fetchJson("/api/retros");
}

export async function fetchRetroBySprint(sprintNumber: number): Promise<RetroSessionSummary | null> {
  const res = await fetch(`/api/retros/by-sprint/${sprintNumber}`, { credentials: "include" });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as JiraErrorResponse;
    throw new ApiError(body.message ?? body.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export async function createRetroSession(sprintNumber: number): Promise<RetroSessionSummary> {
  return fetchJson("/api/retros", {
    method: "POST",
    body: JSON.stringify({ sprintNumber }),
  });
}

export async function fetchRetroSession(id: number): Promise<RetroSessionDetail> {
  return fetchJson(`/api/retros/${id}`);
}

export async function joinRetroSession(id: number): Promise<RetroSessionDetail> {
  return fetchJson(`/api/retros/${id}/join`, { method: "POST" });
}

export async function closeRetroSession(id: number): Promise<RetroSessionSummary> {
  return fetchJson(`/api/retros/${id}/close`, { method: "POST" });
}

export async function reopenRetroSession(id: number): Promise<RetroSessionSummary> {
  return fetchJson(`/api/retros/${id}/reopen`, { method: "POST" });
}

export async function createRetroCard(
  sessionId: number,
  input: CreateRetroCardInput,
): Promise<RetroCard> {
  return fetchJson(`/api/retros/${sessionId}/cards`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateRetroCard(
  sessionId: number,
  cardId: number,
  body: string,
): Promise<RetroCard> {
  return fetchJson(`/api/retros/${sessionId}/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export async function deleteRetroCard(sessionId: number, cardId: number): Promise<void> {
  await fetchJson(`/api/retros/${sessionId}/cards/${cardId}`, { method: "DELETE" });
}

export async function toggleRetroCardReaction(
  sessionId: number,
  cardId: number,
  reaction: RetroReaction,
): Promise<RetroCard> {
  return fetchJson(`/api/retros/${sessionId}/cards/${cardId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ reaction }),
  });
}
