import type {
  AuthUser,
  CreateFollowUpSessionInput,
  FollowUpAgreement,
  FollowUpAnswer,
  FollowUpAssistKind,
  FollowUpEvaluation,
  FollowUpMonthlyReport,
  FollowUpOverallStatus,
  FollowUpPeriodOverview,
  FollowUpReportLang,
  FollowUpSectionKey,
  FollowUpSelfEvaluation,
  FollowUpSessionDetail,
  FollowUpSessionSummary,
  SubmitFollowUpSelfEvaluationInput,
  UpdateFollowUpReportInput,
  UpdateFollowUpSelfEvaluationInput,
  UpdateFollowUpSessionInput,
  UpsertFollowUpAgreementsInput,
  UpsertFollowUpEvaluationInput,
} from "@team-dashboard/shared";
import {
  averageEvaluationScores,
  FOLLOW_UP_ALL_QUESTIONS,
  isValidPeriod,
} from "@team-dashboard/shared";
import { resolveTeamSettings } from "@team-dashboard/shared";
import { getAdminEmail } from "../lib/authConfig";
import { listMembers, getMemberById } from "../db/members";
import { markdownToPdfBuffer } from "../lib/markdownPdf";
import * as followUpDb from "../db/followUp";
import {
  assistFromAnswers,
  FollowUpLlmError,
  generateMonthlyReportLocales,
  getGeminiModelName,
} from "./followUpLlm";

export class FollowUpError extends Error {
  status: 400 | 403 | 404 | 409 | 502;

  constructor(message: string, status: 400 | 403 | 404 | 409 | 502 = 400) {
    super(message);
    this.name = "FollowUpError";
    this.status = status;
  }
}

function requireAdmin(user: AuthUser): void {
  if (user.role !== "admin") {
    throw new FollowUpError("Admin role required", 403);
  }
}

function assertCanViewSession(user: AuthUser, memberId: number): void {
  if (user.role === "admin") {
    return;
  }
  if (user.id !== memberId) {
    throw new FollowUpError("Forbidden", 403);
  }
}

function scoreInRange(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new FollowUpError(`${label} must be an integer from 1 to 5`, 400);
  }
  return value;
}

function toSummary(
  row: followUpDb.FollowUpSessionRow & { evaluation_promedio?: number | null },
): FollowUpSessionSummary {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name ?? "",
    period: row.period,
    status: row.status,
    overallStatus: row.overall_status,
    meetingDate: followUpDb.toIso(row.meeting_date),
    tlFeedback: row.tl_feedback ?? "",
    closingAnswer: row.closing_answer ?? "",
    createdBy: row.created_by,
    createdAt: followUpDb.toIso(row.created_at)!,
    updatedAt: followUpDb.toIso(row.updated_at)!,
    completedAt: followUpDb.toIso(row.completed_at),
    evaluationPromedio:
      row.evaluation_promedio == null ? null : Number(row.evaluation_promedio),
  };
}

type ScoreRow = {
  calidad_tecnica: number;
  cumplimiento: number;
  comunicacion: number;
  colaboracion: number;
  autonomia: number;
  proactividad: number;
  aprendizaje: number;
  tendencia: FollowUpEvaluation["tendencia"];
  observaciones: string;
};

function toEvaluation(row: ScoreRow): FollowUpEvaluation {
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
  };
}

function toSelfEvaluation(row: followUpDb.FollowUpSelfEvaluationRow): FollowUpSelfEvaluation {
  return {
    ...toEvaluation(row),
    memberId: row.member_id,
    period: row.period,
    submittedAt: followUpDb.toIso(row.submitted_at)!,
    updatedAt: followUpDb.toIso(row.updated_at)!,
  };
}

function parseEvaluationInput(input: UpsertFollowUpEvaluationInput) {
  if (!["up", "down", "stable"].includes(input.tendencia)) {
    throw new FollowUpError("Invalid tendencia", 400);
  }
  return {
    calidad_tecnica: scoreInRange(input.calidadTecnica, "calidadTecnica"),
    cumplimiento: scoreInRange(input.cumplimiento, "cumplimiento"),
    comunicacion: scoreInRange(input.comunicacion, "comunicacion"),
    colaboracion: scoreInRange(input.colaboracion, "colaboracion"),
    autonomia: scoreInRange(input.autonomia, "autonomia"),
    proactividad: scoreInRange(input.proactividad, "proactividad"),
    aprendizaje: scoreInRange(input.aprendizaje, "aprendizaje"),
    tendencia: input.tendencia,
    observaciones: input.observaciones ?? "",
  };
}

function selfEvalFlags(
  user: AuthUser,
  memberId: number,
  selfEvaluation: FollowUpSelfEvaluation | null,
) {
  return {
    canSubmitSelfEvaluation: user.id === memberId && selfEvaluation == null,
    canEditSelfEvaluation: user.role === "admin",
  };
}

function toAgreement(row: followUpDb.FollowUpAgreementRow): FollowUpAgreement {
  return {
    id: row.id,
    description: row.description,
    ownerMemberId: row.owner_member_id,
    dueDate: followUpDb.toIso(row.due_date),
    status: row.status,
    notes: row.notes,
    sortOrder: row.sort_order,
  };
}

function toAnswers(rows: followUpDb.FollowUpAnswerRow[]): FollowUpAnswer[] {
  return rows.map((row) => ({
    sectionKey: row.section_key as FollowUpSectionKey,
    questionKey: row.question_key,
    answerText: row.answer_text,
  }));
}

function toReport(row: followUpDb.FollowUpMonthlyReportRow): FollowUpMonthlyReport {
  return {
    id: row.id,
    period: row.period,
    contentMdEs: row.content_md_es ?? "",
    contentMdEn: row.content_md_en ?? "",
    model: row.model,
    generatedBy: row.generated_by,
    generatedAt: followUpDb.toIso(row.generated_at)!,
    updatedBy: row.updated_by ?? null,
    updatedAt: followUpDb.toIso(row.updated_at),
  };
}

function validatePeriod(period: string): string {
  const trimmed = period.trim();
  if (!isValidPeriod(trimmed)) {
    throw new FollowUpError("period must be YYYY-MM", 400);
  }
  return trimmed;
}

const VALID_OVERALL = new Set<FollowUpOverallStatus>([
  "excelente",
  "bien",
  "neutral",
  "preocupado",
  "riesgo",
]);

export async function getPeriodOverview(
  periodRaw: string,
  user: AuthUser,
): Promise<FollowUpPeriodOverview> {
  const period = validatePeriod(periodRaw);
  const memberFilter = user.role === "admin" ? undefined : user.id;
  const sessions = await followUpDb.listSessionsForPeriod(period, memberFilter);
  const sessionByMember = new Map(sessions.map((s) => [s.member_id, s]));

  const adminEmail = getAdminEmail();
  let members;
  if (user.role === "admin") {
    members = (await listMembers({ activeOnly: true })).filter((member) => {
      if (!adminEmail || !member.email) {
        return true;
      }
      return member.email.trim().toLowerCase() !== adminEmail;
    });
  } else {
    const self = await getMemberById(user.id);
    members = self ? [self] : [];
  }

  const rows = members.map((member) => {
    const sessionRow = sessionByMember.get(member.id);
    return {
      memberId: member.id,
      memberName: member.name,
      active: member.active,
      session: sessionRow ? toSummary(sessionRow) : null,
    };
  });

  const completed = rows.filter((r) => r.session?.status === "completed");
  const averages = completed
    .map((r) => r.session?.evaluationPromedio)
    .filter((v): v is number => typeof v === "number");
  const averageIndicators =
    averages.length === 0
      ? null
      : Math.round((averages.reduce((a, b) => a + b, 0) / averages.length) * 10) / 10;
  const atRiskCount = completed.filter((r) => {
    const status = r.session?.overallStatus;
    return status === "preocupado" || status === "riesgo";
  }).length;

  return {
    period,
    members: rows,
    completedCount: completed.length,
    totalCount: rows.length,
    averageIndicators,
    atRiskCount,
  };
}

export async function createSession(
  input: CreateFollowUpSessionInput,
  user: AuthUser,
): Promise<FollowUpSessionSummary> {
  requireAdmin(user);
  const period = validatePeriod(input.period);
  const memberId = Number(input.memberId);
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw new FollowUpError("memberId is required", 400);
  }
  const member = await getMemberById(memberId);
  if (!member || !member.active) {
    throw new FollowUpError("Member not found or inactive", 404);
  }
  const adminEmail = getAdminEmail();
  if (adminEmail && member.email?.trim().toLowerCase() === adminEmail) {
    throw new FollowUpError("Admin is excluded from Follow Up sessions", 400);
  }
  const existing = await followUpDb.getSessionByMemberPeriod(memberId, period);
  if (existing) {
    throw new FollowUpError("Session already exists for this member and period", 409);
  }
  const row = await followUpDb.createSession({
    memberId,
    period,
    createdBy: user.id,
  });
  return toSummary({ ...row, evaluation_promedio: null });
}

export async function getSessionDetail(
  sessionId: number,
  user: AuthUser,
): Promise<FollowUpSessionDetail> {
  const session = await followUpDb.getSessionById(sessionId);
  if (!session) {
    throw new FollowUpError("Session not found", 404);
  }
  assertCanViewSession(user, session.member_id);

  const [answers, evaluation, agreements, selfEvalRow] = await Promise.all([
    followUpDb.listAnswers(sessionId),
    followUpDb.getEvaluation(sessionId),
    followUpDb.listAgreements(sessionId),
    followUpDb.getSelfEvaluation(session.member_id, session.period),
  ]);

  const selfEvaluation = selfEvalRow ? toSelfEvaluation(selfEvalRow) : null;

  return {
    session: toSummary({ ...session, evaluation_promedio: evaluation ? averageEvaluationScores({
      calidadTecnica: evaluation.calidad_tecnica,
      cumplimiento: evaluation.cumplimiento,
      comunicacion: evaluation.comunicacion,
      colaboracion: evaluation.colaboracion,
      autonomia: evaluation.autonomia,
      proactividad: evaluation.proactividad,
      aprendizaje: evaluation.aprendizaje,
    }) : null }),
    answers: toAnswers(answers),
    evaluation: evaluation ? toEvaluation(evaluation) : null,
    selfEvaluation,
    agreements: agreements.map(toAgreement),
    canEdit: user.role === "admin" && session.status === "draft",
    ...selfEvalFlags(user, session.member_id, selfEvaluation),
  };
}

export async function submitSelfEvaluation(
  input: SubmitFollowUpSelfEvaluationInput,
  user: AuthUser,
): Promise<FollowUpSelfEvaluation> {
  const period = validatePeriod(input.period);
  const existing = await followUpDb.getSelfEvaluation(user.id, period);
  if (existing) {
    throw new FollowUpError("Self-evaluation already submitted for this period", 409);
  }
  const row = await followUpDb.insertSelfEvaluation(user.id, period, parseEvaluationInput(input));
  return toSelfEvaluation(row);
}

export async function adminUpsertSelfEvaluation(
  memberId: number,
  periodRaw: string,
  input: UpdateFollowUpSelfEvaluationInput,
  user: AuthUser,
): Promise<FollowUpSelfEvaluation> {
  requireAdmin(user);
  const period = validatePeriod(periodRaw);
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw new FollowUpError("Invalid memberId", 400);
  }
  const member = await getMemberById(memberId);
  if (!member) {
    throw new FollowUpError("Member not found", 404);
  }
  const row = await followUpDb.upsertSelfEvaluationAdmin(
    memberId,
    period,
    parseEvaluationInput(input),
  );
  return toSelfEvaluation(row);
}

export async function updateSession(
  sessionId: number,
  input: UpdateFollowUpSessionInput,
  user: AuthUser,
): Promise<FollowUpSessionDetail> {
  requireAdmin(user);
  const session = await followUpDb.getSessionById(sessionId);
  if (!session) {
    throw new FollowUpError("Session not found", 404);
  }
  if (session.status === "completed") {
    throw new FollowUpError("Completed sessions cannot be edited", 409);
  }

  if (input.overallStatus != null && !VALID_OVERALL.has(input.overallStatus)) {
    throw new FollowUpError("Invalid overallStatus", 400);
  }

  if (input.answers) {
    const known = new Set(FOLLOW_UP_ALL_QUESTIONS.map((q) => q.key));
    for (const answer of input.answers) {
      if (!known.has(answer.questionKey)) {
        throw new FollowUpError(`Unknown questionKey: ${answer.questionKey}`, 400);
      }
    }
    await followUpDb.upsertAnswers(
      sessionId,
      input.answers.map((a) => ({
        sectionKey: a.sectionKey,
        questionKey: a.questionKey,
        answerText: a.answerText ?? "",
      })),
    );
  }

  const patch: Parameters<typeof followUpDb.updateSession>[1] = {};
  if (input.meetingDate !== undefined) {
    patch.meeting_date = input.meetingDate;
  }
  if (input.overallStatus !== undefined) {
    patch.overall_status = input.overallStatus;
  }
  if (input.tlFeedback !== undefined) {
    patch.tl_feedback = input.tlFeedback;
  }
  if (input.closingAnswer !== undefined) {
    patch.closing_answer = input.closingAnswer;
  }
  if (Object.keys(patch).length > 0) {
    await followUpDb.updateSession(sessionId, patch);
  }

  return getSessionDetail(sessionId, user);
}

export async function upsertEvaluation(
  sessionId: number,
  input: UpsertFollowUpEvaluationInput,
  user: AuthUser,
): Promise<FollowUpSessionDetail> {
  requireAdmin(user);
  const session = await followUpDb.getSessionById(sessionId);
  if (!session) {
    throw new FollowUpError("Session not found", 404);
  }
  if (session.status === "completed") {
    throw new FollowUpError("Completed sessions cannot be edited", 409);
  }
  await followUpDb.upsertEvaluation(sessionId, parseEvaluationInput(input));

  return getSessionDetail(sessionId, user);
}

export async function upsertAgreements(
  sessionId: number,
  input: UpsertFollowUpAgreementsInput,
  user: AuthUser,
): Promise<FollowUpSessionDetail> {
  requireAdmin(user);
  const session = await followUpDb.getSessionById(sessionId);
  if (!session) {
    throw new FollowUpError("Session not found", 404);
  }
  if (session.status === "completed") {
    throw new FollowUpError("Completed sessions cannot be edited", 409);
  }

  const cleaned = (input.agreements ?? [])
    .map((a) => ({
      description: (a.description ?? "").trim(),
      owner_member_id: a.ownerMemberId ?? null,
      due_date: a.dueDate ?? null,
      status: a.status ?? ("open" as const),
      notes: a.notes ?? "",
    }))
    .filter((a) => a.description.length > 0);

  await followUpDb.replaceAgreements(sessionId, cleaned);
  return getSessionDetail(sessionId, user);
}

export async function completeSession(
  sessionId: number,
  user: AuthUser,
): Promise<FollowUpSessionDetail> {
  requireAdmin(user);
  const session = await followUpDb.getSessionById(sessionId);
  if (!session) {
    throw new FollowUpError("Session not found", 404);
  }
  if (session.status === "completed") {
    return getSessionDetail(sessionId, user);
  }
  if (!session.overall_status) {
    throw new FollowUpError("overallStatus is required to complete the session", 400);
  }
  const evaluation = await followUpDb.getEvaluation(sessionId);
  if (!evaluation) {
    throw new FollowUpError("Evaluation is required to complete the session", 400);
  }
  const selfEvaluation = await followUpDb.getSelfEvaluation(session.member_id, session.period);
  if (!selfEvaluation) {
    throw new FollowUpError("Self-evaluation is required to complete the session", 400);
  }

  await followUpDb.updateSession(sessionId, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });
  return getSessionDetail(sessionId, user);
}

export async function assistSession(
  sessionId: number,
  kind: FollowUpAssistKind,
  user: AuthUser,
): Promise<{ kind: FollowUpAssistKind; text: string }> {
  requireAdmin(user);
  if (kind !== "tl_feedback" && kind !== "evaluation_notes") {
    throw new FollowUpError("Invalid assist kind", 400);
  }
  const session = await followUpDb.getSessionById(sessionId);
  if (!session) {
    throw new FollowUpError("Session not found", 404);
  }
  const answers = await followUpDb.listAnswers(sessionId);
  try {
    const text = await assistFromAnswers({
      kind,
      memberName: session.member_name ?? "",
      period: session.period,
      overallStatus: session.overall_status,
      answers: answers.map((a) => ({
        questionKey: a.question_key,
        answerText: a.answer_text,
      })),
      tlFeedback: session.tl_feedback,
    });
    return { kind, text };
  } catch (err) {
    if (err instanceof FollowUpLlmError) {
      throw new FollowUpError(err.message, err.status);
    }
    throw err;
  }
}

export async function getReport(
  periodRaw: string,
  user: AuthUser,
): Promise<FollowUpMonthlyReport> {
  requireAdmin(user);
  const period = validatePeriod(periodRaw);
  const row = await followUpDb.getMonthlyReport(period);
  if (!row) {
    throw new FollowUpError("Report not found", 404);
  }
  return toReport(row);
}

export async function generateReport(
  periodRaw: string,
  user: AuthUser,
): Promise<FollowUpMonthlyReport> {
  requireAdmin(user);
  const period = validatePeriod(periodRaw);
  const details = await followUpDb.listCompletedSessionsForPeriod(period);
  if (details.length === 0) {
    throw new FollowUpError("No completed sessions for this period", 400);
  }

  const team = resolveTeamSettings();
  const sessions = details.map(({ session, answers, evaluation, agreements }) => ({
    memberName: session.member_name ?? "",
    overallStatus: session.overall_status,
    meetingDate: followUpDb.toIso(session.meeting_date),
    tlFeedback: session.tl_feedback,
    closingAnswer: session.closing_answer,
    answers: answers.map((a) => ({
      questionKey: a.question_key,
      sectionKey: a.section_key,
      answerText: a.answer_text,
    })),
    evaluation: evaluation
      ? toEvaluation(evaluation)
      : null,
    agreements: agreements.map((a) => ({
      description: a.description,
      status: a.status,
      notes: a.notes,
    })),
  }));

  try {
    const locales = await generateMonthlyReportLocales({
      period,
      teamLabel: team.project || "Development",
      techLead: user.name,
      sessions,
    });
    const row = await followUpDb.upsertMonthlyReport({
      period,
      contentMdEs: locales.contentMdEs,
      contentMdEn: locales.contentMdEn,
      model: getGeminiModelName(),
      generatedBy: user.id,
    });
    return toReport(row);
  } catch (err) {
    if (err instanceof FollowUpLlmError) {
      throw new FollowUpError(err.message, err.status);
    }
    throw err;
  }
}

export async function updateReport(
  periodRaw: string,
  input: UpdateFollowUpReportInput,
  user: AuthUser,
): Promise<FollowUpMonthlyReport> {
  requireAdmin(user);
  const period = validatePeriod(periodRaw);
  if (input.contentMdEs === undefined && input.contentMdEn === undefined) {
    throw new FollowUpError("Provide contentMdEs and/or contentMdEn", 400);
  }
  if (input.contentMdEs !== undefined && typeof input.contentMdEs !== "string") {
    throw new FollowUpError("contentMdEs must be a string", 400);
  }
  if (input.contentMdEn !== undefined && typeof input.contentMdEn !== "string") {
    throw new FollowUpError("contentMdEn must be a string", 400);
  }

  const row = await followUpDb.updateMonthlyReportContent({
    period,
    contentMdEs: input.contentMdEs,
    contentMdEn: input.contentMdEn,
    updatedBy: user.id,
  });
  if (!row) {
    throw new FollowUpError("Report not found", 404);
  }
  return toReport(row);
}

export async function getReportPdf(
  periodRaw: string,
  langRaw: string,
  user: AuthUser,
): Promise<{ buffer: Buffer; filename: string; lang: FollowUpReportLang }> {
  requireAdmin(user);
  const period = validatePeriod(periodRaw);
  const lang = langRaw.trim().toLowerCase();
  if (lang !== "es" && lang !== "en") {
    throw new FollowUpError("lang must be es or en", 400);
  }
  const row = await followUpDb.getMonthlyReport(period);
  if (!row) {
    throw new FollowUpError("Report not found", 404);
  }
  const content = lang === "es" ? row.content_md_es : row.content_md_en;
  if (!content?.trim()) {
    throw new FollowUpError(`Report has no ${lang.toUpperCase()} content`, 400);
  }
  const title =
    lang === "es"
      ? `Resumen 1:1 ${period}`
      : `1:1 Summary ${period}`;
  const filename =
    lang === "es"
      ? `Resumen-1-1-${period}-BM-Competence-ES.pdf`
      : `Summary-1-1-${period}-BM-Competence-EN.pdf`;
  const buffer = await markdownToPdfBuffer(content, title);
  return { buffer, filename, lang };
}
