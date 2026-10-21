export type JiraChangelogItem = {
  field: string;
  fromString?: string | null;
  toString?: string | null;
};

export type JiraChangelogHistory = {
  created: string;
  items?: JiraChangelogItem[];
};

export type JiraRawIssue = {
  id: string;
  key: string;
  fields?: Record<string, unknown>;
};

export type MappedIssue = {
  key: string;
  url: string;
  summary: string;
  type: string;
  status: string;
  assignee: string;
  parent: string | null;
  priority: string;
  storyPoints: number | null;
  originalEstimateHours: number | null;
  timeSpentHours: number | null;
  timeRemainingHours: number | null;
  updated: string;
  created: string;
  resolutiondate: string | null;
  sprint: string | null;
  altenAssignees: string | null;
};

export type IssueWithChangelogAndRaw = {
  issue: IssueWithChangelog;
  raw: JiraRawIssue;
};

export type IssueWithChangelog = {
  id: string;
  key: string;
  url: string;
  summary: string;
  type: string;
  status: string;
  assignee: string;
  resolution: string;
  created: string;
  updated: string;
  storyPoints: number | null;
  sprint: string | null;
  resolutiondate: string | null;
  changelog: JiraChangelogHistory[];
};

export type EpicWithChangelog = {
  key: string;
  url: string;
  summary: string;
  status: string;
  created: string;
  resolutiondate: string | null;
  changelog: JiraChangelogHistory[];
};

export type SprintContext = {
  name: string;
  startDate: string | null;
  endDate: string | null;
  completeDate: string | null;
};

export type SprintTaskSnapshotMeta = {
  sprintNumber: number;
  fetchedAt: string;
  taskCount: number;
};

export type SprintMetricsSnapshotMeta = {
  sprintNumber: number;
  fetchedAt: string;
  metricsCount: number;
};

export type SprintListItem = {
  id: number;
  name: string;
  number: number | null;
  state: string;
  startDate: string | null;
  endDate: string | null;
  completeDate: string | null;
  taskSnapshot?: SprintTaskSnapshotMeta;
  metricsSnapshot?: SprintMetricsSnapshotMeta;
};

export type StatusChange = {
  at: Date;
  from: string;
  to: string;
};
