export type AgileMetricsConfig = {
  cycleStartStatus: string;
  blockedStatus: string;
  refinementStatus: string;
};

export type MetricsRow = {
  issueId: string;
  key: string;
  url: string;
  summary: string;
  type: string;
  status: string;
  assignee: string;
  altenAssignees: string | null;
  resolution: string;
  created: string;
  updated: string;
  storyPoints: number | null;
  sprints: string | null;
  activeSprint: string | null;
  sprintStart: string | null;
  sprintEnd: string | null;
  createdInSprint: "Yes" | "No" | null;
  firstSprint: string | null;
  addedInActiveSprint: "Yes" | "No" | null;
  resolved: string | null;
  leadTimeDays: number | null;
  cycleStartAt: string | null;
  cycleTimeDays: number | null;
  blockedTimeDays: number;
  refinementDays: number;
};

export type EpicStatusRow = {
  key: string;
  url: string;
  summary: string;
  statusDurations: Map<string, number>;
};
