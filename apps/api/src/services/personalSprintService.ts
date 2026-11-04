import type {
  AuthUser,
  PersonalSprintSummarySlice,
  PersonalSprintView,
  SprintMetricsSummary,
} from "@team-dashboard/shared";
import {
  defaultFollowUpPeriod,
  filterMetricsByMembers,
  filterTasksByMembers,
  summarizeSprintMetrics,
} from "@team-dashboard/shared";
import { getMetricsSnapshot } from "../db/sprintMetrics";
import { getSnapshot } from "../db/sprintTasks";
import { getMemberById, listMembers } from "../db/members";
import * as followUpDb from "../db/followUp";
import { averageEvaluationScores } from "@team-dashboard/shared";
import { jiraService } from "./jiraService";
import { FollowUpError } from "./followUpService";

function toSlice(summary: SprintMetricsSummary): PersonalSprintSummarySlice {
  return {
    total: summary.total,
    closed: summary.closed,
    avgLeadTime: summary.avgLeadTime,
    avgCycleTime: summary.avgCycleTime,
    wipCount: summary.wipCount,
    velocityTickets: summary.velocityTickets,
  };
}

function toSelfEvaluation(
  row: NonNullable<Awaited<ReturnType<typeof followUpDb.getSelfEvaluation>>>,
) {
  const scores = {
    calidadTecnica: row.calidad_tecnica,
    cumplimiento: row.cumplimiento,
    comunicacion: row.comunicacion,
    colaboracion: row.colaboracion,
    autonomia: row.autonomia,
    proactividad: row.proactividad,
    aprendizaje: row.aprendizaje,
  };
  return {
    ...scores,
    tendencia: row.tendencia,
    observaciones: row.observaciones,
    promedio: averageEvaluationScores(scores),
    memberId: row.member_id,
    period: row.period,
    submittedAt: followUpDb.toIso(row.submitted_at)!,
    updatedAt: followUpDb.toIso(row.updated_at)!,
  };
}

export async function getPersonalSprintView(
  user: AuthUser,
  options: { memberId?: number; sprintNumber?: number } = {},
): Promise<PersonalSprintView> {
  const memberId = options.memberId ?? user.id;
  if (user.id !== memberId && user.role !== "admin") {
    throw new FollowUpError("Forbidden", 403);
  }

  const member = await getMemberById(memberId);
  if (!member) {
    throw new FollowUpError("Member not found", 404);
  }

  const activeMembers = await listMembers({ activeOnly: true });
  const teamNames = activeMembers.map((m) => m.name);

  let sprintMeta: PersonalSprintView["sprint"] = null;
  let mine: PersonalSprintSummarySlice | null = null;
  let team: PersonalSprintSummarySlice | null = null;
  let tickets: PersonalSprintView["tickets"] = [];

  try {
    const sprints = await jiraService.listSprints();
    const selected =
      options.sprintNumber != null
        ? sprints.find((s) => s.number === options.sprintNumber)
        : sprints.find((s) => s.state === "active") ?? sprints.find((s) => s.number != null);

    if (selected?.number != null) {
      const sprintNumber = selected.number;
      const hasMetricsSnapshot = Boolean(selected.metricsSnapshot);
      const hasTaskSnapshot = Boolean(selected.taskSnapshot);
      sprintMeta = {
        number: sprintNumber,
        name: selected.name,
        state: selected.state,
        hasMetricsSnapshot,
        hasTaskSnapshot,
      };

      const metricsSnapshot = await getMetricsSnapshot(sprintNumber);
      if (metricsSnapshot) {
        const teamRows = filterMetricsByMembers(metricsSnapshot.metrics, teamNames);
        const personalRows = filterMetricsByMembers(metricsSnapshot.metrics, [member.name]);
        team = toSlice(summarizeSprintMetrics(teamRows, { countMembers: teamNames }));
        mine = toSlice(summarizeSprintMetrics(personalRows, { countMembers: [member.name] }));

        const byKey = new Map(personalRows.map((row) => [row.key, row]));
        const taskSnapshot = await getSnapshot(sprintNumber);
        const personalTasks = taskSnapshot
          ? filterTasksByMembers(taskSnapshot.tasks, [member.name])
          : [];

        tickets = personalTasks.map((task) => {
          const metrics = byKey.get(task.key);
          return {
            key: task.key,
            url: task.url,
            summary: task.summary,
            status: task.status,
            type: task.type,
            leadTimeDays: metrics?.leadTimeDays ?? null,
            cycleTimeDays: metrics?.cycleTimeDays ?? null,
          };
        });

        if (tickets.length === 0 && personalRows.length > 0) {
          tickets = personalRows.map((row) => ({
            key: row.key,
            url: row.url,
            summary: row.summary,
            status: row.status,
            type: row.type,
            leadTimeDays: row.leadTimeDays,
            cycleTimeDays: row.cycleTimeDays,
          }));
        }
      }
    }
  } catch {
    // Jira/config unavailable — return member shell without sprint data.
  }

  const followUpPeriod = defaultFollowUpPeriod();
  const [selfEvalRow, session, historyRows] = await Promise.all([
    followUpDb.getSelfEvaluation(memberId, followUpPeriod),
    followUpDb.getSessionByMemberPeriod(memberId, followUpPeriod),
    followUpDb.listSelfEvaluationsForMember(memberId, 6),
  ]);
  const selfEvaluation = selfEvalRow ? toSelfEvaluation(selfEvalRow) : null;
  const selfEvaluationHistory = [...historyRows]
    .reverse()
    .map((row) => toSelfEvaluation(row));

  return {
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
    },
    sprint: sprintMeta,
    mine,
    team,
    tickets,
    followUpPeriod,
    followUpSessionId: session?.id ?? null,
    selfEvaluation,
    selfEvaluationHistory,
    canSubmitSelfEvaluation: user.id === memberId && selfEvaluation == null,
    canEditSelfEvaluation: user.role === "admin",
  };
}
