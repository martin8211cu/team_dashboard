import { Link, createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatPeriodLabel } from "@team-dashboard/shared";
import { ApiError, fetchFollowUpReport, generateFollowUpReport } from "../lib/api";

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
  const [copied, setCopied] = useState(false);

  const reportQuery = useQuery({
    queryKey: ["follow-up-report", period],
    queryFn: () => fetchFollowUpReport(period),
    enabled: Boolean(isAdmin),
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateFollowUpReport(period),
    onSuccess: (report) => {
      setError(null);
      queryClient.setQueryData(["follow-up-report", period], report);
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

  async function downloadMd() {
    const content = reportQuery.data?.contentMd;
    if (!content) {
      return;
    }
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Summary-1-1-${period}-BM-Competence.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyMd() {
    const content = reportQuery.data?.contentMd;
    if (!content) {
      return;
    }
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            </p>
          )}
        </div>
        <div className="follow-up-toolbar-actions">
          <button
            type="button"
            className="sprint-btn sprint-btn-primary"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
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
                className="sprint-btn sprint-btn-secondary"
                onClick={() => void copyMd()}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="sprint-btn sprint-btn-secondary"
                onClick={() => void downloadMd()}
              >
                Download .md
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

      {reportQuery.data && <pre className="follow-up-report-md">{reportQuery.data.contentMd}</pre>}
    </div>
  );
}
