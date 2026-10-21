export const JIRA_FIELD_IDS = {
  storyPoints: "customfield_10016",
  sprint: "customfield_10020",
} as const;

export const JIRA_SEARCH_FIELDS = [
  "summary",
  "status",
  "assignee",
  "issuetype",
  "priority",
  "updated",
  "created",
  "resolutiondate",
  "resolution",
  "timeoriginalestimate",
  "timespent",
  "timeestimate",
  "parent",
  JIRA_FIELD_IDS.storyPoints,
  JIRA_FIELD_IDS.sprint,
] as const;
