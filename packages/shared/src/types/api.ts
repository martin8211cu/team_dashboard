import type { MappedIssue, SprintContext, SprintListItem } from "./jira";
import type { MetricsRow } from "./metrics";
import type { AgileMetricsConfig } from "./metrics";

export type HealthResponse = {
  status: "ok";
  timestamp: string;
};

export type KpiSummary = {
  id: string;
  name: string;
  value: number;
  unit: string;
  updatedAt: string;
};

export type JiraConfigResponse = {
  project: string;
  members: string[];
  agileMetrics: AgileMetricsConfig;
};

export type SprintMetricsResponse = {
  sprintNumber: number;
  sprintName: string;
  sprintState: string;
  fetchedAt: string;
  cached: boolean;
  sprint: SprintContext;
  metrics: MetricsRow[];
};

export type SprintsResponse = {
  sprints: SprintListItem[];
};

export type SprintTasksResponse = {
  sprintNumber: number;
  sprintName: string;
  sprintState: string;
  fetchedAt: string;
  cached: boolean;
  tasks: MappedIssue[];
};

export type SprintLoadResponse = {
  sprintNumber: number;
  sprintName: string;
  sprintState: string;
  fetchedAt: string;
  cached: boolean;
  metrics: SprintMetricsResponse;
  tasks: SprintTasksResponse;
};

export type SprintTasksCompareResponse = {
  sprints: SprintTasksResponse[];
  missing: number[];
};

export type SprintMetricsCompareResponse = {
  sprints: SprintMetricsResponse[];
  missing: number[];
};

export type EpicStatusTimesResponse = {
  columns: string[];
  rows: Record<string, string | number>[];
};

export type JiraErrorResponse = {
  error: string;
  message?: string;
};

export type AuthRole = "admin" | "user";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
};

export type LoginResponse = {
  ok: true;
  user: AuthUser;
};

export type AuthMeResponse = {
  user: AuthUser;
};

export type RetroSessionStatus = "open" | "closed";

export type RetroColumn = "went_well" | "needs_improvement" | "action_items";

export type RetroReaction = "like" | "dislike";

export type RetroSessionSummary = {
  id: number;
  sprintNumber: number;
  status: RetroSessionStatus;
  createdBy: number;
  createdAt: string;
  closedAt: string | null;
  participantCount: number;
  cardCount: number;
};

export type RetroParticipant = {
  memberId: number;
  name: string;
  email: string | null;
  joinedAt: string;
};

export type RetroCard = {
  id: number;
  sessionId: number;
  column: RetroColumn;
  body: string;
  authorId: number;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: RetroReaction | null;
};

export type RetroSessionDetail = {
  session: RetroSessionSummary;
  participants: RetroParticipant[];
  cards: RetroCard[];
  joined: boolean;
};

export type CreateRetroSessionInput = {
  sprintNumber: number;
};

export type CreateRetroCardInput = {
  column: RetroColumn;
  body: string;
};

export type UpdateRetroCardInput = {
  body: string;
};

export type SetRetroReactionInput = {
  reaction: RetroReaction;
};
