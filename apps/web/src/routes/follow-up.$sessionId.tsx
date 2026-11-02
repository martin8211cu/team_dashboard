import { Link, createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type {
  FollowUpAnswer,
  FollowUpEvaluationScores,
  FollowUpOverallStatus,
  FollowUpTendencia,
} from "@team-dashboard/shared";
import {
  FOLLOW_UP_CLOSING_QUESTION,
  FOLLOW_UP_EVALUATION_DIMENSIONS,
  FOLLOW_UP_OVERALL_STATUS_OPTIONS,
  FOLLOW_UP_SECTIONS,
  averageEvaluationScores,
  formatPeriodLabel,
  formatSessionStatus,
  formatTendencia,
} from "@team-dashboard/shared";
import {
  assistFollowUpSession,
  completeFollowUpSession,
  fetchFollowUpSession,
  updateFollowUpSession,
  upsertFollowUpAgreements,
  upsertFollowUpEvaluation,
} from "../lib/api";

export const Route = createFileRoute("/follow-up/$sessionId")({
  component: FollowUpSessionPage,
});

type EvalForm = FollowUpEvaluationScores & {
  tendencia: FollowUpTendencia;
  observaciones: string;
};

const EMPTY_EVAL: EvalForm = {
  calidadTecnica: 3,
  cumplimiento: 3,
  comunicacion: 3,
  colaboracion: 3,
  autonomia: 3,
  proactividad: 3,
  aprendizaje: 3,
  tendencia: "stable",
  observaciones: "",
};

const STEP_META = [
  ...FOLLOW_UP_SECTIONS.map((section) => ({
    short: section.shortTitle,
    title: section.title,
  })),
  { short: "Close-out", title: "Close-out & TL feedback" },
  { short: "Evaluation", title: "Informal evaluation (1–5)" },
];

function answersToMap(answers: FollowUpAnswer[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const answer of answers) {
    map[answer.questionKey] = answer.answerText;
  }
  return map;
}

function FollowUpSessionPage() {
  const { sessionId: sessionIdParam } = Route.useParams();
  const sessionId = Number.parseInt(sessionIdParam, 10);
  const queryClient = useQueryClient();
  const isAdmin = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser?.role === "admin",
  });

  const [step, setStep] = useState(0);
  const [answerMap, setAnswerMap] = useState<Record<string, string>>({});
  const [overallStatus, setOverallStatus] = useState<FollowUpOverallStatus | "">("");
  const [tlFeedback, setTlFeedback] = useState("");
  const [closingAnswer, setClosingAnswer] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [evalForm, setEvalForm] = useState<EvalForm>(EMPTY_EVAL);
  const [agreementText, setAgreementText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [assistNote, setAssistNote] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["follow-up-session", sessionId],
    queryFn: () => fetchFollowUpSession(sessionId),
    enabled: Number.isFinite(sessionId),
    retry: false,
  });

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail) {
      return;
    }
    setAnswerMap(answersToMap(detail.answers));
    setOverallStatus(detail.session.overallStatus ?? "");
    setTlFeedback(detail.session.tlFeedback);
    const closingFromAnswers = detail.answers.find(
      (a) => a.questionKey === FOLLOW_UP_CLOSING_QUESTION.key,
    )?.answerText;
    setClosingAnswer(closingFromAnswers || detail.session.closingAnswer || "");
    setMeetingDate(detail.session.meetingDate?.slice(0, 10) ?? "");
    if (detail.evaluation) {
      setEvalForm({
        calidadTecnica: detail.evaluation.calidadTecnica,
        cumplimiento: detail.evaluation.cumplimiento,
        comunicacion: detail.evaluation.comunicacion,
        colaboracion: detail.evaluation.colaboracion,
        autonomia: detail.evaluation.autonomia,
        proactividad: detail.evaluation.proactividad,
        aprendizaje: detail.evaluation.aprendizaje,
        tendencia: detail.evaluation.tendencia,
        observaciones: detail.evaluation.observaciones,
      });
    }
    setAgreementText(detail.agreements.map((a) => a.description).join("\n"));
  }, [detailQuery.data]);

  const canEdit = Boolean(detailQuery.data?.canEdit && isAdmin);
  const sections = FOLLOW_UP_SECTIONS;
  const totalSteps = STEP_META.length;

  const promedio = useMemo(() => averageEvaluationScores(evalForm), [evalForm]);

  const buildAnswers = (): FollowUpAnswer[] => [
    ...FOLLOW_UP_SECTIONS.flatMap((section) =>
      section.questions.map((q) => ({
        sectionKey: q.sectionKey,
        questionKey: q.key,
        answerText: answerMap[q.key] ?? "",
      })),
    ),
    {
      sectionKey: FOLLOW_UP_CLOSING_QUESTION.sectionKey,
      questionKey: FOLLOW_UP_CLOSING_QUESTION.key,
      answerText: closingAnswer,
    },
  ];

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateFollowUpSession(sessionId, {
        answers: buildAnswers(),
        overallStatus: overallStatus || null,
        tlFeedback,
        closingAnswer,
        meetingDate: meetingDate || null,
      });
      await upsertFollowUpEvaluation(sessionId, evalForm);
      const agreements = agreementText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((description) => ({ description }));
      await upsertFollowUpAgreements(sessionId, { agreements });
      return fetchFollowUpSession(sessionId);
    },
    onSuccess: (detail) => {
      setError(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      queryClient.setQueryData(["follow-up-session", sessionId], detail);
      queryClient.invalidateQueries({ queryKey: ["follow-up"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();
      return completeFollowUpSession(sessionId);
    },
    onSuccess: (detail) => {
      setError(null);
      queryClient.setQueryData(["follow-up-session", sessionId], detail);
      queryClient.invalidateQueries({ queryKey: ["follow-up"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const assistMutation = useMutation({
    mutationFn: async (kind: "tl_feedback" | "evaluation_notes") => {
      await updateFollowUpSession(sessionId, {
        answers: buildAnswers(),
        overallStatus: overallStatus || null,
        tlFeedback,
        closingAnswer,
        meetingDate: meetingDate || null,
      });
      return assistFollowUpSession(sessionId, { kind });
    },
    onSuccess: (result) => {
      setAssistNote(null);
      if (result.kind === "tl_feedback") {
        setTlFeedback(result.text);
      } else {
        setEvalForm((prev) => ({ ...prev, observaciones: result.text }));
      }
    },
    onError: (err: Error) => setAssistNote(err.message),
  });

  if (!Number.isFinite(sessionId)) {
    return <p className="alert">Invalid session id</p>;
  }

  if (detailQuery.isLoading) {
    return <p>Loading session...</p>;
  }

  if (detailQuery.isError) {
    return <p className="alert">{(detailQuery.error as Error).message}</p>;
  }

  const detail = detailQuery.data!;
  const session = detail.session;
  const stepProgress = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <div className="follow-up-session">
      <div className="follow-up-session-header">
        <div>
          <Link to="/follow-up" search={{ period: session.period }} className="follow-up-back">
            ← {formatPeriodLabel(session.period)}
          </Link>
          <h2 className="follow-up-session-title">
            {session.memberName}
            <span className={`status-pill follow-up-status-${session.status}`}>
              {formatSessionStatus(session.status)}
            </span>
            {!canEdit && <span className="follow-up-readonly-badge">Read-only</span>}
          </h2>
          <p className="meta-line meta-muted">
            Step {step + 1} of {totalSteps} · {STEP_META[step]!.title}
          </p>
        </div>
        {canEdit && (
          <div className="follow-up-toolbar-actions">
            {savedFlash && <span className="follow-up-saved-flash">Saved</span>}
            <button
              type="button"
              className="sprint-btn sprint-btn-secondary"
              disabled={saveMutation.isPending || completeMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              className="sprint-btn sprint-btn-primary"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
            >
              {completeMutation.isPending ? "Completing..." : "Mark complete"}
            </button>
          </div>
        )}
      </div>

      <div className="follow-up-progress" aria-hidden="true">
        <div className="follow-up-progress-bar" style={{ width: `${stepProgress}%` }} />
      </div>

      {error && <p className="alert">{error}</p>}
      {assistNote && <p className="alert">{assistNote}</p>}

      <nav className="follow-up-steps" aria-label="Session steps">
        {STEP_META.map((meta, index) => (
          <button
            key={meta.short}
            type="button"
            className={`follow-up-step${step === index ? " is-active" : ""}${
              index < step ? " is-done" : ""
            }`}
            onClick={() => setStep(index)}
          >
            <span className="follow-up-step-num">{index + 1}</span>
            <span className="follow-up-step-label">{meta.short}</span>
          </button>
        ))}
      </nav>

      {step < sections.length && (
        <section className="follow-up-panel">
          <header className="follow-up-panel-header">
            <div>
              <h3>{sections[step]!.title}</h3>
              {sections[step]!.description && (
                <p className="meta-line">{sections[step]!.description}</p>
              )}
            </div>
            {sections[step]!.durationHint && (
              <span className="follow-up-duration">{sections[step]!.durationHint}</span>
            )}
          </header>
          <div className="follow-up-questions">
            {sections[step]!.questions.map((question) => (
              <label key={question.key} className="follow-up-field">
                <span>{question.label}</span>
                <textarea
                  rows={3}
                  value={answerMap[question.key] ?? ""}
                  disabled={!canEdit}
                  placeholder={canEdit ? "Capture the answer…" : undefined}
                  onChange={(event) =>
                    setAnswerMap((prev) => ({ ...prev, [question.key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {step === sections.length && (
        <section className="follow-up-panel">
          <header className="follow-up-panel-header">
            <div>
              <h3>Close-out & TL feedback</h3>
              <p className="meta-line">Wrap up the conversation and capture leadership notes.</p>
            </div>
          </header>
          <div className="follow-up-close-grid">
            <label className="follow-up-field">
              <span>Meeting date</span>
              <input
                type="date"
                value={meetingDate}
                disabled={!canEdit}
                onChange={(event) => setMeetingDate(event.target.value)}
              />
            </label>
            <label className="follow-up-field">
              <span>Overall status</span>
              <select
                value={overallStatus}
                disabled={!canEdit}
                onChange={(event) =>
                  setOverallStatus(event.target.value as FollowUpOverallStatus | "")
                }
              >
                <option value="">Select…</option>
                {FOLLOW_UP_OVERALL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="follow-up-field">
            <span>
              {FOLLOW_UP_CLOSING_QUESTION.label}
              {FOLLOW_UP_CLOSING_QUESTION.hint && (
                <small className="meta-muted"> · {FOLLOW_UP_CLOSING_QUESTION.hint}</small>
              )}
            </span>
            <textarea
              rows={3}
              value={closingAnswer}
              disabled={!canEdit}
              onChange={(event) => setClosingAnswer(event.target.value)}
            />
          </label>
          <label className="follow-up-field">
            <span>TL feedback</span>
            <textarea
              rows={5}
              value={tlFeedback}
              disabled={!canEdit}
              placeholder="Strengths, improvement areas, concrete examples, next-month expectations…"
              onChange={(event) => setTlFeedback(event.target.value)}
            />
          </label>
          {canEdit && (
            <button
              type="button"
              className="sprint-btn sprint-btn-secondary"
              disabled={assistMutation.isPending}
              onClick={() => assistMutation.mutate("tl_feedback")}
            >
              {assistMutation.isPending ? "Asking Gemini…" : "Suggest TL feedback with Gemini"}
            </button>
          )}
        </section>
      )}

      {step === sections.length + 1 && (
        <section className="follow-up-panel">
          <header className="follow-up-panel-header">
            <div>
              <h3>Informal evaluation</h3>
              <p className="meta-line">Scale 1–5 · used for promotions and early risk signals.</p>
            </div>
            <div className="follow-up-avg-chip" title={`Trend: ${formatTendencia(evalForm.tendencia)}`}>
              Avg <strong>{promedio}</strong>
            </div>
          </header>
          <div className="follow-up-eval-grid">
            {FOLLOW_UP_EVALUATION_DIMENSIONS.map((dim) => (
              <div key={dim.key} className="follow-up-score-card">
                <div className="follow-up-score-card-copy">
                  <strong>{dim.label}</strong>
                  <span className="meta-muted">{dim.description}</span>
                </div>
                <div className="follow-up-score-pills" role="group" aria-label={dim.label}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      className={`follow-up-score-pill${
                        evalForm[dim.key] === score ? " is-selected" : ""
                      }`}
                      disabled={!canEdit}
                      onClick={() => setEvalForm((prev) => ({ ...prev, [dim.key]: score }))}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <label className="follow-up-field">
            <span>Trend</span>
            <select
              value={evalForm.tendencia}
              disabled={!canEdit}
              onChange={(event) =>
                setEvalForm((prev) => ({
                  ...prev,
                  tendencia: event.target.value as FollowUpTendencia,
                }))
              }
            >
              <option value="up">↑ Improving</option>
              <option value="stable">→ Stable</option>
              <option value="down">↓ Declining</option>
            </select>
          </label>
          <label className="follow-up-field">
            <span>Notes</span>
            <textarea
              rows={4}
              value={evalForm.observaciones}
              disabled={!canEdit}
              placeholder="Evidence and focus for next cycle…"
              onChange={(event) =>
                setEvalForm((prev) => ({ ...prev, observaciones: event.target.value }))
              }
            />
          </label>
          {canEdit && (
            <button
              type="button"
              className="sprint-btn sprint-btn-secondary"
              disabled={assistMutation.isPending}
              onClick={() => assistMutation.mutate("evaluation_notes")}
            >
              {assistMutation.isPending ? "Asking Gemini…" : "Suggest notes with Gemini"}
            </button>
          )}
          <label className="follow-up-field">
            <span>Action items</span>
            <textarea
              rows={4}
              value={agreementText}
              disabled={!canEdit}
              placeholder="One commitment per line"
              onChange={(event) => setAgreementText(event.target.value)}
            />
          </label>
        </section>
      )}

      <div className="follow-up-nav">
        <button
          type="button"
          className="sprint-btn sprint-btn-ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="sprint-btn sprint-btn-secondary"
          disabled={step >= totalSteps - 1}
          onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
