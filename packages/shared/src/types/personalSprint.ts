import type { FollowUpSelfEvaluation } from "./followUp";

export type PersonalSprintSummarySlice = {
  total: number;
  closed: number;
  avgLeadTime: number | null;
  avgCycleTime: number | null;
  wipCount: number;
  velocityTickets: number;
};

export type PersonalSprintTicket = {
  key: string;
  url: string;
  summary: string;
  status: string;
  type: string;
  leadTimeDays: number | null;
  cycleTimeDays: number | null;
};

export type PersonalSprintView = {
  member: {
    id: number;
    name: string;
    email: string | null;
  };
  sprint: {
    number: number;
    name: string;
    state: string;
    hasMetricsSnapshot: boolean;
    hasTaskSnapshot: boolean;
  } | null;
  mine: PersonalSprintSummarySlice | null;
  team: PersonalSprintSummarySlice | null;
  tickets: PersonalSprintTicket[];
  followUpPeriod: string;
  followUpSessionId: number | null;
  selfEvaluation: FollowUpSelfEvaluation | null;
  /** Oldest → newest, up to 6 periods with a submitted self-evaluation. */
  selfEvaluationHistory: FollowUpSelfEvaluation[];
  canSubmitSelfEvaluation: boolean;
  canEditSelfEvaluation: boolean;
};
