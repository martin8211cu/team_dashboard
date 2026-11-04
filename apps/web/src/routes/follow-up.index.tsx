import { Link, createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  defaultFollowUpPeriod,
  formatOverallStatus,
  formatPeriodLabel,
  formatSessionStatus,
  listFollowUpPeriodOptions,
} from "@team-dashboard/shared";
import {
  createFollowUpSession,
  fetchFollowUpPeriod,
  generateFollowUpReport,
} from "../lib/api";

type FollowUpSearch = {
  period?: string;
};

export const Route = createFileRoute("/follow-up/")({
  validateSearch: (search: Record<string, unknown>): FollowUpSearch => ({
    period: typeof search.period === "string" ? search.period : undefined,
  }),
  component: FollowUpIndexPage,
});

function FollowUpIndexPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { period: periodSearch } = Route.useSearch();
  const period =
    periodSearch && /^\d{4}-\d{2}$/.test(periodSearch) ? periodSearch : defaultFollowUpPeriod();
  const periodOptions = useMemo(() => {
    const options = listFollowUpPeriodOptions();
    return options.includes(period) ? options : [period, ...options];
  }, [period]);
  const isAdmin = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser?.role === "admin",
  });
  const [error, setError] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["follow-up", period],
    queryFn: () => fetchFollowUpPeriod(period),
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: (memberId: number) => createFollowUpSession({ memberId, period }),
    onSuccess: (session) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["follow-up", period] });
      void navigate({
        to: "/follow-up/$sessionId",
        params: { sessionId: String(session.id) },
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const reportMutation = useMutation({
    mutationFn: () => generateFollowUpReport(period),
    onSuccess: () => {
      setError(null);
      void navigate({
        to: "/follow-up/reports/$period",
        params: { period },
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (overviewQuery.isLoading) {
    return <p>Loading Follow Up...</p>;
  }

  if (overviewQuery.isError) {
    return <p className="alert">{(overviewQuery.error as Error).message}</p>;
  }

  const data = overviewQuery.data!;
  const progressPct =
    data.totalCount === 0 ? 0 : Math.round((data.completedCount / data.totalCount) * 100);

  return (
    <div className="follow-up-page">
      <div className="follow-up-toolbar">
        <div className="follow-up-toolbar-lead">
          <p className="meta-line follow-up-lede">
            {isAdmin
              ? "1:1s always cover the previous month. Capture Q&A, score the informal evaluation, then generate the BM / Competence summary."
              : "Your monthly 1:1 sessions (previous month). Read-only view."}
          </p>
          <label className="follow-up-period-label">
            Period
            <select
              value={period}
              aria-label="Follow Up period"
              onChange={(event) => {
                void navigate({
                  to: "/follow-up",
                  search: { period: event.target.value },
                });
              }}
            >
              {periodOptions.map((value) => (
                <option key={value} value={value}>
                  {formatPeriodLabel(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isAdmin && (
          <div className="follow-up-toolbar-actions">
            <button
              type="button"
              className="sprint-btn sprint-btn-secondary"
              onClick={() =>
                void navigate({
                  to: "/follow-up/reports/$period",
                  params: { period },
                })
              }
            >
              View report
            </button>
            <button
              type="button"
              className="sprint-btn sprint-btn-primary"
              disabled={reportMutation.isPending || data.completedCount === 0}
              onClick={() => reportMutation.mutate()}
              title={data.completedCount === 0 ? "Complete at least one session first" : undefined}
            >
              {reportMutation.isPending ? "Generating..." : "Generate report"}
            </button>
          </div>
        )}
      </div>

      <div className="kpi-grid follow-up-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">
              <span className="kpi-label-text">Period</span>
            </span>
          </div>
          <p className="kpi-value follow-up-kpi-value-sm">{formatPeriodLabel(period)}</p>
          <p className="kpi-meta">{period}</p>
        </article>
        <article className="kpi-card kpi-card-green">
          <div className="kpi-card-header">
            <span className="kpi-label">
              <span className="kpi-label-text">1:1s completed</span>
            </span>
          </div>
          <p className="kpi-value">
            {data.completedCount}
            <span className="follow-up-kpi-suffix">/{data.totalCount}</span>
          </p>
          <p className="kpi-meta">{progressPct}% of roster</p>
        </article>
        <article className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">
              <span className="kpi-label-text">Team average</span>
            </span>
          </div>
          <p className="kpi-value">{data.averageIndicators ?? "—"}</p>
          <p className="kpi-meta">Indicators scale 1–5</p>
        </article>
        <article className={`kpi-card${data.atRiskCount > 0 ? " kpi-card-amber" : ""}`}>
          <div className="kpi-card-header">
            <span className="kpi-label">
              <span className="kpi-label-text">At risk / concerned</span>
            </span>
          </div>
          <p className="kpi-value">{data.atRiskCount}</p>
          <p className="kpi-meta">From completed sessions</p>
        </article>
      </div>

      <div className="follow-up-progress" aria-hidden="true">
        <div className="follow-up-progress-bar" style={{ width: `${progressPct}%` }} />
      </div>

      {error && <p className="alert">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Session</th>
              <th>Overall</th>
              <th>TL avg</th>
              <th>Self avg</th>
              <th aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((row) => {
              const session = row.session;
              return (
                <tr key={row.memberId}>
                  <td>
                    <span className="follow-up-member-name">{row.memberName}</span>
                  </td>
                  <td>
                    {session ? (
                      <span className={`status-pill follow-up-status-${session.status}`}>
                        {formatSessionStatus(session.status)}
                      </span>
                    ) : (
                      <span className="meta-muted">Not started</span>
                    )}
                  </td>
                  <td>{formatOverallStatus(session?.overallStatus)}</td>
                  <td>{session?.evaluationPromedio ?? "—"}</td>
                  <td>{row.selfEvaluationPromedio ?? "—"}</td>
                  <td className="retro-list-actions">
                    {session ? (
                      <Link
                        to="/follow-up/$sessionId"
                        params={{ sessionId: String(session.id) }}
                        className="sprint-btn sprint-btn-secondary"
                      >
                        {isAdmin && session.status === "draft" ? "Continue" : "Open"}
                      </Link>
                    ) : isAdmin ? (
                      <button
                        type="button"
                        className="sprint-btn sprint-btn-primary"
                        disabled={startMutation.isPending}
                        onClick={() => startMutation.mutate(row.memberId)}
                      >
                        Start 1:1
                      </button>
                    ) : (
                      <span className="meta-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
