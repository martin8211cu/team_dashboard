import { getDb } from "@team-dashboard/db";
import type {
  FollowUpAgreementStatus,
  FollowUpOverallStatus,
  FollowUpSessionStatus,
  FollowUpTendencia,
} from "@team-dashboard/shared";

export type FollowUpSessionRow = {
  id: number;
  member_id: number;
  period: string;
  status: FollowUpSessionStatus;
  overall_status: FollowUpOverallStatus | null;
  meeting_date: Date | string | null;
  tl_feedback: string;
  closing_answer: string;
  created_by: number;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
  member_name?: string;
};

export type FollowUpAnswerRow = {
  id: number;
  session_id: number;
  section_key: string;
  question_key: string;
  answer_text: string;
  updated_at: Date | string;
};

export type FollowUpEvaluationRow = {
  session_id: number;
  calidad_tecnica: number;
  cumplimiento: number;
  comunicacion: number;
  colaboracion: number;
  autonomia: number;
  proactividad: number;
  aprendizaje: number;
  tendencia: FollowUpTendencia;
  observaciones: string;
  updated_at: Date | string;
};

export type FollowUpSelfEvaluationRow = {
  id: number;
  member_id: number;
  period: string;
  calidad_tecnica: number;
  cumplimiento: number;
  comunicacion: number;
  colaboracion: number;
  autonomia: number;
  proactividad: number;
  aprendizaje: number;
  tendencia: FollowUpTendencia;
  observaciones: string;
  submitted_at: Date | string;
  updated_at: Date | string;
};

type SelfEvaluationScoresInput = {
  calidad_tecnica: number;
  cumplimiento: number;
  comunicacion: number;
  colaboracion: number;
  autonomia: number;
  proactividad: number;
  aprendizaje: number;
  tendencia: FollowUpTendencia;
  observaciones: string;
};

export type FollowUpAgreementRow = {
  id: number;
  session_id: number;
  description: string;
  owner_member_id: number | null;
  due_date: Date | string | null;
  status: FollowUpAgreementStatus;
  notes: string;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type FollowUpMonthlyReportRow = {
  id: number;
  period: string;
  content_md_es: string;
  content_md_en: string;
  model: string;
  generated_by: number;
  generated_at: Date | string;
  updated_by: number | null;
  updated_at: Date | string | null;
};

export function toIso(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

export async function listSessionsForPeriod(
  period: string,
  memberIdFilter?: number,
): Promise<Array<FollowUpSessionRow & { evaluation_promedio: number | null }>> {
  const params: Array<string | number> = [period];
  let memberClause = "";
  if (memberIdFilter != null) {
    memberClause = " AND s.member_id = ?";
    params.push(memberIdFilter);
  }

  const result = await getDb().raw(
    `SELECT s.*, m.name AS member_name,
        CASE WHEN e.session_id IS NULL THEN NULL
          ELSE ROUND((
            e.calidad_tecnica + e.cumplimiento + e.comunicacion + e.colaboracion
            + e.autonomia + e.proactividad + e.aprendizaje
          )::numeric / 7, 1)
        END AS evaluation_promedio
       FROM follow_up_sessions s
       JOIN team_members m ON m.id = s.member_id
       LEFT JOIN follow_up_evaluations e ON e.session_id = s.id
       WHERE s.period = ?${memberClause}
       ORDER BY lower(m.name)`,
    params,
  );
  return result.rows as Array<FollowUpSessionRow & { evaluation_promedio: number | null }>;
}

export async function getSessionById(id: number): Promise<FollowUpSessionRow | null> {
  const result = await getDb().raw(
    `SELECT s.*, m.name AS member_name
       FROM follow_up_sessions s
       JOIN team_members m ON m.id = s.member_id
       WHERE s.id = ?`,
    [id],
  );
  return (result.rows[0] as FollowUpSessionRow | undefined) ?? null;
}

export async function getSessionByMemberPeriod(
  memberId: number,
  period: string,
): Promise<FollowUpSessionRow | null> {
  const result = await getDb().raw(
    `SELECT s.*, m.name AS member_name
       FROM follow_up_sessions s
       JOIN team_members m ON m.id = s.member_id
       WHERE s.member_id = ? AND s.period = ?`,
    [memberId, period],
  );
  return (result.rows[0] as FollowUpSessionRow | undefined) ?? null;
}

export async function createSession(input: {
  memberId: number;
  period: string;
  createdBy: number;
}): Promise<FollowUpSessionRow> {
  const [inserted] = await getDb()("follow_up_sessions")
    .insert({
      member_id: input.memberId,
      period: input.period,
      status: "draft",
      created_by: input.createdBy,
    })
    .returning<FollowUpSessionRow[]>("*");
  const row = await getSessionById(inserted!.id);
  return row!;
}

export async function updateSession(
  id: number,
  patch: {
    meeting_date?: Date | string | null;
    overall_status?: FollowUpOverallStatus | null;
    tl_feedback?: string;
    closing_answer?: string;
    status?: FollowUpSessionStatus;
    completed_at?: Date | string | null;
  },
): Promise<FollowUpSessionRow | null> {
  await getDb()("follow_up_sessions")
    .where({ id })
    .update({ ...patch, updated_at: getDb().fn.now() });
  return getSessionById(id);
}

export async function listAnswers(sessionId: number): Promise<FollowUpAnswerRow[]> {
  return getDb()("follow_up_answers")
    .where({ session_id: sessionId })
    .orderBy("id")
    .select<FollowUpAnswerRow[]>("*");
}

export async function upsertAnswers(
  sessionId: number,
  answers: Array<{ sectionKey: string; questionKey: string; answerText: string }>,
): Promise<void> {
  if (answers.length === 0) {
    return;
  }
  const db = getDb();
  for (const answer of answers) {
    const existing = await db("follow_up_answers")
      .where({ session_id: sessionId, question_key: answer.questionKey })
      .first<{ id: number }>();
    if (existing) {
      await db("follow_up_answers")
        .where({ id: existing.id })
        .update({
          section_key: answer.sectionKey,
          answer_text: answer.answerText,
          updated_at: db.fn.now(),
        });
    } else {
      await db("follow_up_answers").insert({
        session_id: sessionId,
        section_key: answer.sectionKey,
        question_key: answer.questionKey,
        answer_text: answer.answerText,
      });
    }
  }
}

export async function getEvaluation(sessionId: number): Promise<FollowUpEvaluationRow | null> {
  const row = await getDb()("follow_up_evaluations")
    .where({ session_id: sessionId })
    .first<FollowUpEvaluationRow>();
  return row ?? null;
}

export async function getSelfEvaluation(
  memberId: number,
  period: string,
): Promise<FollowUpSelfEvaluationRow | null> {
  const row = await getDb()("follow_up_self_evaluations")
    .where({ member_id: memberId, period })
    .first<FollowUpSelfEvaluationRow>();
  return row ?? null;
}

export async function listSelfEvaluationsForMember(
  memberId: number,
  limit = 6,
): Promise<FollowUpSelfEvaluationRow[]> {
  return getDb()("follow_up_self_evaluations")
    .where({ member_id: memberId })
    .orderBy("period", "desc")
    .limit(limit)
    .select<FollowUpSelfEvaluationRow[]>("*");
}

export async function insertSelfEvaluation(
  memberId: number,
  period: string,
  input: SelfEvaluationScoresInput,
): Promise<FollowUpSelfEvaluationRow> {
  const [inserted] = await getDb()("follow_up_self_evaluations")
    .insert({
      member_id: memberId,
      period,
      ...input,
    })
    .returning<FollowUpSelfEvaluationRow[]>("*");
  return inserted!;
}

export async function upsertSelfEvaluationAdmin(
  memberId: number,
  period: string,
  input: SelfEvaluationScoresInput,
): Promise<FollowUpSelfEvaluationRow> {
  const existing = await getSelfEvaluation(memberId, period);
  if (existing) {
    await getDb()("follow_up_self_evaluations")
      .where({ id: existing.id })
      .update({ ...input, updated_at: getDb().fn.now() });
  } else {
    await getDb()("follow_up_self_evaluations").insert({
      member_id: memberId,
      period,
      ...input,
    });
  }
  return (await getSelfEvaluation(memberId, period))!;
}

export async function upsertEvaluation(
  sessionId: number,
  input: SelfEvaluationScoresInput,
): Promise<FollowUpEvaluationRow> {
  const existing = await getEvaluation(sessionId);
  if (existing) {
    await getDb()("follow_up_evaluations")
      .where({ session_id: sessionId })
      .update({ ...input, updated_at: getDb().fn.now() });
  } else {
    await getDb()("follow_up_evaluations").insert({
      session_id: sessionId,
      ...input,
    });
  }
  return (await getEvaluation(sessionId))!;
}

export async function listAgreements(sessionId: number): Promise<FollowUpAgreementRow[]> {
  return getDb()("follow_up_agreements")
    .where({ session_id: sessionId })
    .orderBy("sort_order")
    .orderBy("id")
    .select<FollowUpAgreementRow[]>("*");
}

export async function replaceAgreements(
  sessionId: number,
  agreements: Array<{
    description: string;
    owner_member_id: number | null;
    due_date: string | null;
    status: FollowUpAgreementStatus;
    notes: string;
  }>,
): Promise<FollowUpAgreementRow[]> {
  const db = getDb();
  await db("follow_up_agreements").where({ session_id: sessionId }).del();
  if (agreements.length > 0) {
    await db("follow_up_agreements").insert(
      agreements.map((agreement, index) => ({
        session_id: sessionId,
        description: agreement.description,
        owner_member_id: agreement.owner_member_id,
        due_date: agreement.due_date,
        status: agreement.status,
        notes: agreement.notes,
        sort_order: index,
      })),
    );
  }
  return listAgreements(sessionId);
}

export async function listCompletedSessionsForPeriod(period: string): Promise<
  Array<{
    session: FollowUpSessionRow;
    answers: FollowUpAnswerRow[];
    evaluation: FollowUpEvaluationRow | null;
    agreements: FollowUpAgreementRow[];
  }>
> {
  const sessions = await listSessionsForPeriod(period);
  const completed = sessions.filter((session) => session.status === "completed");
  const details = [];
  for (const session of completed) {
    details.push({
      session,
      answers: await listAnswers(session.id),
      evaluation: await getEvaluation(session.id),
      agreements: await listAgreements(session.id),
    });
  }
  return details;
}

export async function getMonthlyReport(period: string): Promise<FollowUpMonthlyReportRow | null> {
  const row = await getDb()("follow_up_monthly_reports")
    .where({ period })
    .first<FollowUpMonthlyReportRow>();
  return row ?? null;
}

export async function upsertMonthlyReport(input: {
  period: string;
  contentMdEs: string;
  contentMdEn: string;
  model: string;
  generatedBy: number;
}): Promise<FollowUpMonthlyReportRow> {
  const existing = await getMonthlyReport(input.period);
  if (existing) {
    await getDb()("follow_up_monthly_reports")
      .where({ id: existing.id })
      .update({
        content_md_es: input.contentMdEs,
        content_md_en: input.contentMdEn,
        model: input.model,
        generated_by: input.generatedBy,
        generated_at: getDb().fn.now(),
        updated_by: input.generatedBy,
        updated_at: getDb().fn.now(),
      });
  } else {
    await getDb()("follow_up_monthly_reports").insert({
      period: input.period,
      content_md_es: input.contentMdEs,
      content_md_en: input.contentMdEn,
      model: input.model,
      generated_by: input.generatedBy,
      updated_by: input.generatedBy,
      updated_at: getDb().fn.now(),
    });
  }
  return (await getMonthlyReport(input.period))!;
}

export async function updateMonthlyReportContent(input: {
  period: string;
  contentMdEs?: string;
  contentMdEn?: string;
  updatedBy: number;
}): Promise<FollowUpMonthlyReportRow | null> {
  const existing = await getMonthlyReport(input.period);
  if (!existing) {
    return null;
  }
  const patch: Record<string, unknown> = {
    updated_by: input.updatedBy,
    updated_at: getDb().fn.now(),
  };
  if (input.contentMdEs !== undefined) {
    patch.content_md_es = input.contentMdEs;
  }
  if (input.contentMdEn !== undefined) {
    patch.content_md_en = input.contentMdEn;
  }
  await getDb()("follow_up_monthly_reports").where({ id: existing.id }).update(patch);
  return getMonthlyReport(input.period);
}
