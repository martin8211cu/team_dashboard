import { useEffect, useState } from "react";
import type {
  FollowUpSelfEvaluation,
  FollowUpTendencia,
  UpsertFollowUpEvaluationInput,
} from "@team-dashboard/shared";
import {
  FOLLOW_UP_EVALUATION_DIMENSIONS,
  averageEvaluationScores,
  formatPeriodLabel,
  formatTendencia,
} from "@team-dashboard/shared";

type EvalForm = UpsertFollowUpEvaluationInput;

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

function fromSelfEvaluation(value: FollowUpSelfEvaluation | null | undefined): EvalForm {
  if (!value) {
    return EMPTY_EVAL;
  }
  return {
    calidadTecnica: value.calidadTecnica,
    cumplimiento: value.cumplimiento,
    comunicacion: value.comunicacion,
    colaboracion: value.colaboracion,
    autonomia: value.autonomia,
    proactividad: value.proactividad,
    aprendizaje: value.aprendizaje,
    tendencia: value.tendencia,
    observaciones: value.observaciones,
  };
}

type SelfEvaluationFormProps = {
  period: string;
  value: FollowUpSelfEvaluation | null;
  canSubmit: boolean;
  canEdit: boolean;
  busy?: boolean;
  onSubmit: (input: UpsertFollowUpEvaluationInput) => void;
  onAdminSave: (input: UpsertFollowUpEvaluationInput) => void;
};

export function SelfEvaluationForm({
  period,
  value,
  canSubmit,
  canEdit,
  busy = false,
  onSubmit,
  onAdminSave,
}: SelfEvaluationFormProps) {
  const [form, setForm] = useState<EvalForm>(() => fromSelfEvaluation(value));
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setForm(fromSelfEvaluation(value));
  }, [value]);

  const editable = canSubmit || canEdit;
  const promedio = averageEvaluationScores(form);

  return (
    <section className="follow-up-panel self-eval-panel">
      <header className="follow-up-panel-header">
        <div>
          <h3>Self-evaluation</h3>
          <p className="meta-line">
            {formatPeriodLabel(period)} · Scale 1–5
            {value ? ` · Submitted ${new Date(value.submittedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="follow-up-avg-chip" title={`Trend: ${formatTendencia(form.tendencia)}`}>
          Avg <strong>{promedio}</strong>
        </div>
      </header>

      {!editable && !value && (
        <p className="meta-muted">No self-evaluation submitted for this period yet.</p>
      )}

      {(editable || value) && (
        <>
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
                        form[dim.key] === score ? " is-selected" : ""
                      }`}
                      disabled={!editable || busy}
                      onClick={() => setForm((prev) => ({ ...prev, [dim.key]: score }))}
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
              value={form.tendencia}
              disabled={!editable || busy}
              onChange={(event) =>
                setForm((prev) => ({
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
              rows={3}
              value={form.observaciones}
              disabled={!editable || busy}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, observaciones: event.target.value }))
              }
            />
          </label>

          {canSubmit && (
            <div className="self-eval-actions">
              <button
                type="button"
                className="sprint-btn sprint-btn-primary"
                disabled={busy}
                onClick={() => setConfirmOpen(true)}
              >
                Submit self-evaluation
              </button>
            </div>
          )}

          {canEdit && !canSubmit && (
            <div className="self-eval-actions">
              <button
                type="button"
                className="sprint-btn sprint-btn-secondary"
                disabled={busy}
                onClick={() => onAdminSave(form)}
              >
                {busy ? "Saving…" : value ? "Save self-evaluation" : "Create self-evaluation"}
              </button>
            </div>
          )}
        </>
      )}

      {confirmOpen && (
        <div className="self-eval-confirm" role="dialog" aria-modal="true">
          <div className="self-eval-confirm-card">
            <h4>Confirm self-evaluation</h4>
            <p>
              You will not be able to change these scores after submitting. Continue for{" "}
              <strong>{formatPeriodLabel(period)}</strong>?
            </p>
            <div className="self-eval-actions">
              <button
                type="button"
                className="sprint-btn sprint-btn-secondary"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sprint-btn sprint-btn-primary"
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false);
                  onSubmit(form);
                }}
              >
                {busy ? "Submitting…" : "Confirm & submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
