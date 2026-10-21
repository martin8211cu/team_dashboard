import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { filterMetricsByMembers, summarizeSprintMetrics } from "@team-dashboard/shared";
import { useTeamMemberFilterContext } from "../components/TeamMemberFilterContext";
import { SprintMetricsCharts } from "../components/charts/SprintMetricsCharts";
import { SummaryCards } from "../components/SummaryCards";
import { fetchSprintMetrics, loadSprint } from "../lib/api";
import { applyMemberFilter } from "../lib/memberFilter";

type SprintSearch = {
  sprint?: number;
};

export const Route = createFileRoute("/sprint")({
  validateSearch: (search: Record<string, unknown>): SprintSearch => {
    const raw = search.sprint;
    const sprint =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseInt(raw, 10)
          : undefined;
    return {
      sprint: sprint != null && !Number.isNaN(sprint) && sprint > 0 ? sprint : undefined,
    };
  },
  component: SprintPage,
});

function SprintPage() {
  const queryClient = useQueryClient();
  const canWrite = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser?.role === "admin",
  });
  const { sprint: viewSprint } = Route.useSearch();

  const { teamOnly, filterMemberNames } = useTeamMemberFilterContext();

  const metricsQuery = useQuery({
    queryKey: ["sprint-metrics", viewSprint],
    queryFn: () => fetchSprintMetrics(viewSprint!),
    enabled: viewSprint != null,
    retry: false,
  });

  const loadMutation = useMutation({
    mutationFn: () => loadSprint(viewSprint!),
    onSuccess: (data) => {
      if (viewSprint != null) {
        queryClient.setQueryData(["sprint-metrics", viewSprint], data.metrics);
      }
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });

  const filteredMetrics = useMemo(() => {
    if (!metricsQuery.data) {
      return [];
    }

    return applyMemberFilter(
      metricsQuery.data.metrics,
      teamOnly,
      filterMemberNames,
      filterMetricsByMembers,
    );
  }, [metricsQuery.data, teamOnly, filterMemberNames]);

  const summary = useMemo(
    () =>
      filteredMetrics.length > 0
        ? summarizeSprintMetrics(filteredMetrics, {
            countMembers: teamOnly ? filterMemberNames : undefined,
          })
        : null,
    [filteredMetrics, teamOnly, filterMemberNames],
  );

  const isLoadingFromJira = loadMutation.isPending;

  return (
    <>
      <div className="page-toolbar">
        <div className="section-header-actions">
          {viewSprint != null && (
            <Link
              to="/tasks/compare"
              search={{ sprints: [viewSprint] }}
              className="sprint-btn sprint-btn-secondary section-header-link"
            >
              View tasks
            </Link>
          )}
          <Link to="/sprints" className="sprint-btn sprint-btn-secondary section-header-link">
            Back to Sprints
          </Link>
        </div>
      </div>

      {viewSprint && (canWrite || metricsQuery.data?.cached) && (
        <div className="sprint-metrics-actions">
          {canWrite && (
            <button
              type="button"
              className="sprint-btn sprint-btn-primary"
              onClick={() => loadMutation.mutate()}
              disabled={isLoadingFromJira}
            >
              {isLoadingFromJira ? "Loading sprint…" : "Load / reload sprint"}
            </button>
          )}
          {metricsQuery.data?.cached && (
            <span className="meta-line">
              Local snapshot · {metricsQuery.data.fetchedAt.slice(0, 16).replace("T", " ")}
            </span>
          )}
        </div>
      )}

      {!viewSprint && (
        <p className="meta-line">
          Select a sprint from the{" "}
          <Link to="/sprints">Sprints list</Link> or from a sprint&apos;s tasks.
        </p>
      )}

      {isLoadingFromJira && (
        <div className="loading-box">
          <p>Loading metrics for sprint {viewSprint} from Jira…</p>
          <p className="meta-line">
            Fetching changelogs issue by issue. Usually takes 1–3 minutes. Check the API
            terminal.
          </p>
        </div>
      )}

      {metricsQuery.isLoading && !isLoadingFromJira && viewSprint && (
        <p className="meta-line">Reading snapshot…</p>
      )}

      {metricsQuery.isError && !isLoadingFromJira && (
        <p className="alert">
          {(metricsQuery.error as Error).message}.{" "}
          {viewSprint &&
            (canWrite ? (
              <>
                Load metrics from{" "}
                <Link to="/sprints">Sprints</Link> or click &quot;Load / reload sprint&quot;.
              </>
            ) : (
              <>Ask an admin to load this sprint from Jira.</>
            ))}
        </p>
      )}

      {metricsQuery.data && !isLoadingFromJira && (
        <>
          <div className="page-subheader">
            <h2>{metricsQuery.data.sprint.name}</h2>
            <span className="meta-line meta-line-inline">
              {metricsQuery.data.sprint.startDate?.slice(0, 10) ?? "?"} →{" "}
              {metricsQuery.data.sprint.endDate?.slice(0, 10) ??
                metricsQuery.data.sprint.completeDate?.slice(0, 10) ??
                "active"}
              {" · "}
              {metricsQuery.data.cached ? "from DB" : "just loaded"}
            </span>
          </div>

          {summary && <SummaryCards summary={summary} />}

          {summary && <SprintMetricsCharts summary={summary} metrics={filteredMetrics} />}

          {!summary && (
            <p className="meta-line">No tickets with the current filter.</p>
          )}
        </>
      )}
    </>
  );
}
