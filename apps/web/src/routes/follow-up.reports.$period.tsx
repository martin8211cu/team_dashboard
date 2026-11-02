import { Link, createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatPeriodLabel, type FollowUpReportLang } from "@team-dashboard/shared";
import {
  ApiError,
  downloadFollowUpReportPdf,
  fetchFollowUpReport,
  generateFollowUpReport,
  updateFollowUpReport,
} from "../lib/api";

export const Route = createFileRoute("/follow-up/reports/$period")({
  component: FollowUpReportPage,
});

function FollowUpReportPage() {
  const { period } = Route.useParams();
  const queryClient = useQueryClient();
  const isAdmin = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser?.role === "admin",
  });
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<FollowUpReportLang>("es");
  const [draftEs, setDraftEs] = useState("");
  const [draftEn, setDraftEn] = useState("");
  const [dirty, setDirty] = useState(false);

  const reportQuery = useQuery({
    queryKey: ["follow-up-report", period],
    queryFn: () => fetchFollowUpReport(period),
    enabled: Boolean(isAdmin),
    retry: false,
  });

  useEffect(() => {
    if (!reportQuery.data) {
      return;
    }
    setDraftEs(reportQuery.data.contentMdEs);
    setDraftEn(reportQuery.data.contentMdEn);
    setDirty(false);
  }, [reportQuery.data]);

  const generateMutation = useMutation({
    mutationFn: () => generateFollowUpReport(period),
    onSuccess: (report) => {
      setError(null);
      queryClient.setQueryData(["follow-up-report", period], report);
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      updateFollowUpReport(period, {
        contentMdEs: draftEs,
        contentMdEn: draftEn,
      }),
    onSuccess: (report) => {
      setError(null);
      setDirty(false);
      queryClient.setQueryData(["follow-up-report", period], report);
    },
    onError: (err: Error) => setError(err.message),
  });

  const pdfMutation = useMutation({
    mutationFn: async (targetLang: FollowUpReportLang) => {
      if (dirty) {
        await updateFollowUpReport(period, {
          contentMdEs: draftEs,
          contentMdEn: draftEn,
        }).then((report) => {
          setDirty(false);
          queryClient.setQueryData(["follow-up-report", period], report);
        });
      }
      await downloadFollowUpReportPdf(period, targetLang);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!isAdmin) {
    return (
      <p className="alert">
        Only admins can view monthly Follow Up reports.{" "}
        <Link to="/follow-up" search={{ period }}>
          Back to Follow Up
        </Link>
      </p>
    );
  }

  const missing =
    reportQuery.isError &&
    reportQuery.error instanceof ApiError &&
    reportQuery.error.status === 404;

  const draft = lang === "es" ? draftEs : draftEn;

  function onDraftChange(value: string) {
    setDirty(true);
    if (lang === "es") {
      setDraftEs(value);
    } else {
      setDraftEn(value);
    }
  }

  return (
    <div className="follow-up-report">
      <div className="follow-up-session-header">
        <div>
          <Link to="/follow-up" search={{ period }} className="follow-up-back">
            ← Follow Up
          </Link>
          <h2 className="follow-up-session-title">
            Monthly report
            <span className="follow-up-readonly-badge">{formatPeriodLabel(period)}</span>
          </h2>
          {reportQuery.data && (
            <p className="meta-line meta-muted">
              Model {reportQuery.data.model} · generated{" "}
              {new Date(reportQuery.data.generatedAt).toLocaleString("en-US")}
              {reportQuery.data.updatedAt &&
                reportQuery.data.updatedAt !== reportQuery.data.generatedAt && (
                  <>
                    {" "}
                    · edited {new Date(reportQuery.data.updatedAt).toLocaleString("en-US")}
                  </>
                )}
              {dirty && <> · unsaved changes</>}
            </p>
          )}
        </div>
        <div className="follow-up-toolbar-actions">
          <button
            type="button"
            className="sprint-btn sprint-btn-primary"
            disabled={generateMutation.isPending}
            onClick={() => {
              if (
                dirty &&
                !window.confirm("Regenerate will overwrite unsaved edits. Continue?")
              ) {
                return;
              }
              generateMutation.mutate();
            }}
          >
            {generateMutation.isPending
              ? "Generating…"
              : missing
                ? "Generate with Gemini"
                : "Regenerate"}
          </button>
          {reportQuery.data && (
            <>
              <button
                type="button"
                className="sprint-btn sprint-btn-primary"
                disabled={!dirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="sprint-btn sprint-btn-secondary"
                disabled={pdfMutation.isPending || !draftEs.trim()}
                onClick={() => pdfMutation.mutate("es")}
              >
                PDF ES
              </button>
              <button
                type="button"
                className="sprint-btn sprint-btn-secondary"
                disabled={pdfMutation.isPending || !draftEn.trim()}
                onClick={() => pdfMutation.mutate("en")}
              >
                PDF EN
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="alert">{error}</p>}
      {reportQuery.isLoading && <p>Loading report…</p>}
      {missing && !generateMutation.isPending && (
        <div className="follow-up-empty-report">
          <p className="meta-line">
            No report yet for <strong>{formatPeriodLabel(period)}</strong>. Generate one from
            completed 1:1 sessions.
          </p>
        </div>
      )}
      {reportQuery.isError && !missing && (
        <p className="alert">{(reportQuery.error as Error).message}</p>
      )}

      {reportQuery.data && (
        <>
          <div className="follow-up-report-lang-tabs" role="tablist" aria-label="Report language">
            <button
              type="button"
              role="tab"
              aria-selected={lang === "es"}
              className={
                lang === "es"
                  ? "sprint-btn sprint-btn-primary"
                  : "sprint-btn sprint-btn-secondary"
              }
              onClick={() => setLang("es")}
            >
              Español
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lang === "en"}
              className={
                lang === "en"
                  ? "sprint-btn sprint-btn-primary"
                  : "sprint-btn sprint-btn-secondary"
              }
              onClick={() => setLang("en")}
            >
              English
            </button>
          </div>
          <textarea
            className="follow-up-report-editor"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            spellCheck={lang === "en"}
            aria-label={lang === "es" ? "Spanish report markdown" : "English report markdown"}
          />
        </>
      )}
    </div>
  );
}
