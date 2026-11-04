export type FollowUpSessionStatus = "draft" | "completed";

export type FollowUpOverallStatus =
  | "excelente"
  | "bien"
  | "neutral"
  | "preocupado"
  | "riesgo";

export type FollowUpTendencia = "up" | "down" | "stable";

export type FollowUpAgreementStatus = "open" | "in_progress" | "done" | "cancelled";

export type FollowUpAssistKind = "tl_feedback" | "evaluation_notes";

export type FollowUpSectionKey =
  | "bienestar"
  | "logros"
  | "desempeno"
  | "desarrollo"
  | "acciones"
  | "cierre";

export type FollowUpEvaluationScores = {
  calidadTecnica: number;
  cumplimiento: number;
  comunicacion: number;
  colaboracion: number;
  autonomia: number;
  proactividad: number;
  aprendizaje: number;
};

export type FollowUpEvaluation = FollowUpEvaluationScores & {
  tendencia: FollowUpTendencia;
  observaciones: string;
  promedio: number;
};

export type FollowUpSelfEvaluation = FollowUpEvaluation & {
  memberId: number;
  period: string;
  submittedAt: string;
  updatedAt: string;
};

export type FollowUpAnswer = {
  sectionKey: FollowUpSectionKey;
  questionKey: string;
  answerText: string;
};

export type FollowUpAgreement = {
  id: number;
  description: string;
  ownerMemberId: number | null;
  dueDate: string | null;
  status: FollowUpAgreementStatus;
  notes: string;
  sortOrder: number;
};

export type FollowUpSessionSummary = {
  id: number;
  memberId: number;
  memberName: string;
  period: string;
  status: FollowUpSessionStatus;
  overallStatus: FollowUpOverallStatus | null;
  meetingDate: string | null;
  tlFeedback: string;
  closingAnswer: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  evaluationPromedio: number | null;
};

export type FollowUpPeriodMemberRow = {
  memberId: number;
  memberName: string;
  active: boolean;
  session: FollowUpSessionSummary | null;
  selfEvaluationPromedio: number | null;
};

export type FollowUpPeriodOverview = {
  period: string;
  members: FollowUpPeriodMemberRow[];
  completedCount: number;
  totalCount: number;
  averageIndicators: number | null;
  atRiskCount: number;
};

export type FollowUpSessionDetail = {
  session: FollowUpSessionSummary;
  answers: FollowUpAnswer[];
  evaluation: FollowUpEvaluation | null;
  selfEvaluation: FollowUpSelfEvaluation | null;
  agreements: FollowUpAgreement[];
  canEdit: boolean;
  canSubmitSelfEvaluation: boolean;
  canEditSelfEvaluation: boolean;
};

export type FollowUpReportLang = "es" | "en";

export type FollowUpMonthlyReport = {
  id: number;
  period: string;
  contentMdEs: string;
  contentMdEn: string;
  model: string;
  generatedBy: number;
  generatedAt: string;
  updatedBy: number | null;
  updatedAt: string | null;
};

export type UpdateFollowUpReportInput = {
  contentMdEs?: string;
  contentMdEn?: string;
};

export type CreateFollowUpSessionInput = {
  memberId: number;
  period: string;
};

export type UpdateFollowUpSessionInput = {
  meetingDate?: string | null;
  overallStatus?: FollowUpOverallStatus | null;
  tlFeedback?: string;
  closingAnswer?: string;
  answers?: FollowUpAnswer[];
};

export type UpsertFollowUpEvaluationInput = FollowUpEvaluationScores & {
  tendencia: FollowUpTendencia;
  observaciones: string;
};

export type SubmitFollowUpSelfEvaluationInput = UpsertFollowUpEvaluationInput & {
  period: string;
};

export type UpdateFollowUpSelfEvaluationInput = UpsertFollowUpEvaluationInput;

export type UpsertFollowUpAgreementsInput = {
  agreements: Array<{
    id?: number;
    description: string;
    ownerMemberId?: number | null;
    dueDate?: string | null;
    status?: FollowUpAgreementStatus;
    notes?: string;
  }>;
};

export type FollowUpAssistInput = {
  kind: FollowUpAssistKind;
};

export type FollowUpAssistResponse = {
  kind: FollowUpAssistKind;
  text: string;
};
