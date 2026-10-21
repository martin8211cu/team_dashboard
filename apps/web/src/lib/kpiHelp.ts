import type { KpiIconName } from "../components/KpiIcon";

export type KpiHelpId =
  | KpiIconName
  | "wipByStatus"
  | "topBlocked"
  | "velocitySp"
  | "velocityTickets"
  | "commitmentSpPct"
  | "commitmentTicketsPct";

export const KPI_HELP: Record<KpiHelpId, string> = {
  total: "All issues in the sprint snapshot, including open and closed.",
  closed: "Issues in Done, Closed, or Canceled.",
  open: "Issues that were still open when metrics were calculated.",
  commitment: "How much of the sprint plan was delivered: story points and tickets marked done.",
  wip: "Tickets currently in flow (in progress, test, blocked, etc.), not yet closed.",
  scopeCreep: "Tickets added to the sprint after it started.",
  bugRate: "New bugs created in the sprint, as a share of tickets delivered.",
  blockedTotal: "Total days all tickets spent in Waiting Feedback.",
  leadTime: "Average time from issue creation to resolution.",
  cycleTime: "Average time from first move into To Do until resolution.",
  blocked: "Average Waiting Feedback time per ticket.",
  refinement: "Average time spent in In Design & Specs.",
  bugNew: "Bug-type issues created during the sprint.",
  bugCarried: "Bugs in the sprint that existed before the sprint started.",
  wipByStatus: "Open tickets in WIP statuses, broken down by workflow state.",
  topBlocked: "Issues with the longest accumulated Waiting Feedback time.",
  velocitySp: "Planned story points in the sprint versus points on done tickets.",
  velocityTickets: "Tickets in sprint scope versus tickets completed.",
  commitmentSpPct: "Percent of planned story points completed by sprint end.",
  commitmentTicketsPct: "Percent of sprint tickets completed by sprint end.",
};
