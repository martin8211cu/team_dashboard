import type { AgileMetricsConfig } from "./metrics";

export type TeamSettings = {
  project: string;
  epicsSummaryContains?: string;
  boardId?: number;
  /** Only expose sprints with number >= this value in lists and sync. */
  minSprintNumber?: number;
  agileMetrics?: Partial<AgileMetricsConfig>;
};

/** Runtime config: Jira/project settings + active members from DB */
export type TeamConfig = TeamSettings & {
  members: string[];
};

export const DEFAULT_AGILE_METRICS: AgileMetricsConfig = {
  cycleStartStatus: "To Do",
  blockedStatus: "Waiting Feedback",
  refinementStatus: "In Design And Specifications",
};
