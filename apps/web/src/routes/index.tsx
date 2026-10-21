import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { filterMetricsByMembers, summarizeSprintMetrics } from "@team-dashboard/shared";
import { SprintMetricsCharts } from "../components/charts/SprintMetricsCharts";
import { SummaryCards } from "../components/SummaryCards";
import { useTeamMemberFilterContext } from "../components/TeamMemberFilterContext";
import { fetchHealth, fetchSprintMetrics, fetchSprints, loadSprint } from "../lib/api";
import { applyMemberFilter } from "../lib/memberFilter";

export const Route = createFileRoute("/")({
  component: OverviewPage,
});

function OverviewPage() {
  const queryClient = useQueryClient();
  const canWrite = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser?.role === "admin",
  });
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null);

  const healthQuery = useQuery({ queryKey: ["health"], queryFn: fetchHealth });
  const sprintsQuery = useQuery({ queryKey: ["sprints"], queryFn: fetchSprints, retry: false });
  const { teamOnly, filterMemberNames } = useTeamMemberFilterContext();

  const sprintOptions = useMemo(
    () =>
      (sprintsQuery.data ?? [])
        .filter((sprint) => sprint.number != null)
        .sort((a, b) => (b.number ?? 0) - (a.number ?? 0)),
    [sprintsQuery.data],
  );

  const defaultSprintNumber = useMemo(() => {
    const active = sprintOptions.find((sprint) => sprint.state === "active");
    if (active?.number != null) {
      return active.number;
    }
    return sprintOptions[0]?.number ?? null;
  }, [sprintOptions]);

  useEffect(() => {
    if (selectedSprint == null && defaultSprintNumber != null) {
      setSelectedSprint(defaultSprintNumber);
    }
  }, [defaultSprintNumber, selectedSprint]);

  const metricsQuery = useQuery({
    queryKey: ["sprint-metrics", selectedSprint],
    queryFn: () => fetchSprintMetrics(selectedSprint!),
    enabled: selectedSprint != null,
    retry: false,
  });

  const selectedSprintMeta = sprintOptions.find((sprint) => sprint.number === selectedSprint);
  const showLoadButton = Boolean(
    canWrite &&
      selectedSprint != null &&
      selectedSprintMeta &&
      (!selectedSprintMeta.metricsSnapshot || !selectedSprintMeta.taskSnapshot),
  );

  const loadSprintMutation = useMutation({
    mutationFn: () => loadSprint(selectedSprint!),
    onSuccess: (data) => {
      if (selectedSprint != null) {
        queryClient.setQueryData(["sprint-metrics", selectedSprint], data.metrics);
      }
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });

  const isLoadingFromJira = loadSprintMutation.isPending;

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

  return (
    <>
      {selectedSprint != null && (
        <div className="page-toolbar">
          <Link
            to="/sprint"
            search={{ sprint: selectedSprint }}
            className="sprint-btn sprint-btn-secondary section-header-link"
          >
            Sprint details
          </Link>
        </div>
      )}

      <div className="dashboard-toolbar">
        <label className="dashboard-sprint-select">
          Sprint
          <select
            value={selectedSprint ?? ""}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              setSelectedSprint(Number.isNaN(value) ? null : value);
            }}
            disabled={sprintsQuery.isLoading || sprintOptions.length === 0}
          >
            {sprintOptions.length === 0 ? (
              <option value="">No sprints</option>
            ) : (
              sprintOptions.map((sprint) => (
                <option key={sprint.id} value={sprint.number!}>
                  {sprint.name}
                  {sprint.state === "active" ? " (active)" : ""}
                  {sprint.metricsSnapshot ? "" : " · no snapshot"}
                </option>
              ))
            )}
          </select>
        </label>
        {showLoadButton && (
          <button
            type="button"
            className="sprint-btn sprint-btn-primary"
            onClick={() => loadSprintMutation.mutate()}
            disabled={isLoadingFromJira}
          >
            {isLoadingFromJira ? "Loading sprint…" : "Load sprint"}
          </button>
        )}
      </div>

      {isLoadingFromJira && (
        <div className="loading-box">
          <p>Loading sprint {selectedSprint} from Jira…</p>
          <p className="meta-line">
            Fetching changelogs issue by issue. Usually takes 1–3 minutes.
          </p>
        </div>
      )}

      {metricsQuery.isLoading && selectedSprint != null && !isLoadingFromJira && (
        <p className="meta-line">Reading snapshot…</p>
      )}

      {loadSprintMutation.isError && (
        <p className="alert">{(loadSprintMutation.error as Error).message}</p>
      )}

      {metricsQuery.data && !isLoadingFromJira && (
        <>
          <div className="page-subheader">
            <h2>{metricsQuery.data.sprintName}</h2>
            <span className="meta-line meta-line-inline">
              Snapshot: {metricsQuery.data.fetchedAt.slice(0, 16).replace("T", " ")}
            </span>
          </div>

          {summary && (
            <>
              <SummaryCards summary={summary} />
              <SprintMetricsCharts summary={summary} metrics={filteredMetrics} />
            </>
          )}

          {filteredMetrics.length === 0 && (
            <p className="meta-line">No tickets with the current filter.</p>
          )}
        </>
      )}

      <p className="status">
        API: {healthQuery.data?.status ?? "..."} · {healthQuery.data?.timestamp ?? ""}
      </p>
    </>
  );
}
