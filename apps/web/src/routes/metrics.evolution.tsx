import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  filterMetricsByMembers,
  summarizeSprintEvolution,
} from "@team-dashboard/shared";
import { EvolutionCharts } from "../components/charts/EvolutionCharts";
import { SprintEvolutionPicker } from "../components/SprintEvolutionPicker";
import { useTeamMemberFilterContext } from "../components/TeamMemberFilterContext";
import { fetchSprintMetricsCompare, fetchSprints } from "../lib/api";
import {
  getStoredEvolutionSprints,
  storeEvolutionSprints,
} from "../lib/evolutionSprintStorage";
import { applyMemberFilter } from "../lib/memberFilter";

type EvolutionSearch = {
  sprints: number[];
};

export const Route = createFileRoute("/metrics/evolution")({
  validateSearch: (search: Record<string, unknown>): EvolutionSearch => {
    const raw = search.sprints;
    const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
    const sprints = values
      .map((value) => Number.parseInt(String(value).trim(), 10))
      .filter((value) => !Number.isNaN(value) && value > 0);
    return { sprints };
  },
  component: MetricsEvolutionPage,
});

function buildDefaultSelection(sprints: Array<{ number: number | null; metricsSnapshot?: unknown }>): number[] {
  return sprints
    .filter((sprint) => sprint.number != null && sprint.metricsSnapshot != null)
    .sort((a, b) => (b.number ?? 0) - (a.number ?? 0))
    .slice(0, 6)
    .map((sprint) => sprint.number!)
    .sort((a, b) => a - b);
}

function MetricsEvolutionPage() {
  const navigate = useNavigate();
  const { sprints: selectedFromUrl } = Route.useSearch();
  const initializedRef = useRef(false);

  const sprintsQuery = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    retry: false,
  });

  const sprints = sprintsQuery.data ?? [];

  const defaultSelection = useMemo(() => buildDefaultSelection(sprints), [sprints]);

  const selected = useMemo(() => {
    if (selectedFromUrl.length > 0) {
      return selectedFromUrl;
    }

    const stored = getStoredEvolutionSprints();
    if (stored != null) {
      return stored;
    }

    return defaultSelection;
  }, [defaultSelection, selectedFromUrl]);

  useEffect(() => {
    if (initializedRef.current || sprints.length === 0) {
      return;
    }

    initializedRef.current = true;

    if (selectedFromUrl.length > 0) {
      storeEvolutionSprints(selectedFromUrl);
      return;
    }

    const stored = getStoredEvolutionSprints();
    const initial = stored != null && stored.length > 0 ? stored : defaultSelection;

    if (initial.length === 0) {
      return;
    }

    storeEvolutionSprints(initial);
    navigate({
      to: "/metrics/evolution",
      search: { sprints: initial },
      replace: true,
    });
  }, [defaultSelection, navigate, selectedFromUrl, sprints.length]);

  const { teamOnly, filterMemberNames } = useTeamMemberFilterContext();

  const compareQuery = useQuery({
    queryKey: ["sprint-metrics-compare", selected],
    queryFn: () => fetchSprintMetricsCompare(selected),
    enabled: selected.length > 0,
    retry: false,
  });

  const evolutionPoints = useMemo(() => {
    if (!compareQuery.data) {
      return [];
    }

    const filtered = compareQuery.data.sprints.map((sprint) => ({
      sprintNumber: sprint.sprintNumber,
      sprintName: sprint.sprintName,
      metrics: applyMemberFilter(sprint.metrics, teamOnly, filterMemberNames, filterMetricsByMembers),
    }));

    return summarizeSprintEvolution(filtered);
  }, [compareQuery.data, teamOnly, filterMemberNames]);

  function updateSelection(next: number[]) {
    storeEvolutionSprints(next);
    navigate({
      to: "/metrics/evolution",
      search: next.length > 0 ? { sprints: next } : { sprints: [] },
      replace: true,
    });
  }

  return (
    <>
      <div className="page-toolbar">
        <Link to="/sprints" className="sprint-btn sprint-btn-secondary section-header-link">
          Back to Sprints
        </Link>
      </div>

      <p className="page-intro">
        Compare velocity (Planned/Done), cycle time, lead time, and new bugs across sprints with a snapshot.
      </p>

      {sprintsQuery.isLoading && <p className="meta-line">Loading sprints…</p>}
      {sprintsQuery.isError && <p className="alert">{(sprintsQuery.error as Error).message}</p>}

      {sprintsQuery.data && (
        <SprintEvolutionPicker
          sprints={sprintsQuery.data}
          selected={selected}
          onChange={updateSelection}
        />
      )}

      {compareQuery.isLoading && selected.length > 0 && (
        <p className="meta-line">Loading snapshots…</p>
      )}

      {compareQuery.data?.missing.length ? (
        <p className="alert">
          No metrics snapshot for: {compareQuery.data.missing.join(", ")}. Load them from{" "}
          <Link to="/sprints">Sprints</Link>.
        </p>
      ) : null}

      {selected.length === 0 ? (
        <p className="meta-line">Select at least one sprint with a metrics snapshot.</p>
      ) : (
        <EvolutionCharts points={evolutionPoints} />
      )}
    </>
  );
}
