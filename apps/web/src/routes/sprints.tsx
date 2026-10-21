import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SprintListItem } from "@team-dashboard/shared";
import { SprintActionIcon } from "../components/SprintActionIcon";
import { useTeamMemberFilterContext } from "../components/TeamMemberFilterContext";
import {
  createRetroSession,
  exportSprintFile,
  fetchRetroBySprint,
  fetchSprints,
  loadSprint,
} from "../lib/api";

type ExportTarget = { kind: "sprint"; sprintNumber: number };

type SprintAction =
  | { id: "load"; label: string; icon: "download" | "refresh" }
  | { id: "view-tasks"; label: string; sprintNumber: number; icon: "tasks" }
  | { id: "view-metrics"; label: string; sprintNumber: number; icon: "metrics" }
  | { id: "export"; label: string; icon: "export" }
  | { id: "retro"; label: string; sprintNumber: number; icon: "retro" };

export const Route = createFileRoute("/sprints")({
  component: SprintsPage,
});

const STATE_LABELS: Record<string, string> = {
  active: "Active",
  closed: "Closed",
  future: "Future",
};

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}

function formatSnapshotDate(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

function sprintStateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}

function SprintStatePill({ state }: { state: string }) {
  return <span className={`status-pill sprint-state-${state}`}>{sprintStateLabel(state)}</span>;
}

function hasSprintSnapshot(sprint: SprintListItem): boolean {
  return sprint.taskSnapshot != null && sprint.metricsSnapshot != null;
}

function getSprintActions(sprint: SprintListItem, canWrite: boolean): SprintAction[] {
  if (sprint.number == null) {
    return [];
  }

  const sprintNumber = sprint.number;
  const hasFullSnapshot = hasSprintSnapshot(sprint);
  const hasPartialSnapshot =
    !hasFullSnapshot && (sprint.taskSnapshot != null || sprint.metricsSnapshot != null);
  const canReload = sprint.state === "active";

  if (!hasFullSnapshot && !hasPartialSnapshot) {
    const actions: SprintAction[] = [];
    if (canWrite) {
      actions.push({ id: "load", label: "Load sprint", icon: "download" });
    }
    actions.push({ id: "retro", label: "Retro", sprintNumber, icon: "retro" });
    return actions;
  }

  const actions: SprintAction[] = [];

  if (canWrite && hasPartialSnapshot) {
    actions.push({
      id: "load",
      label: canReload ? "Complete snapshot" : "Load sprint",
      icon: "download",
    });
  }

  if (sprint.taskSnapshot != null || hasFullSnapshot) {
    actions.push({ id: "view-tasks", label: "View tasks", sprintNumber, icon: "tasks" });
  }

  if (sprint.metricsSnapshot != null || hasFullSnapshot) {
    actions.push({ id: "view-metrics", label: "View metrics", sprintNumber, icon: "metrics" });
  }

  actions.push({ id: "export", label: "Export Excel", icon: "export" });
  actions.push({ id: "retro", label: "Retro", sprintNumber, icon: "retro" });

  if (canWrite && hasFullSnapshot && canReload) {
    actions.push({ id: "load", label: "Reload sprint", icon: "refresh" });
  }

  return actions;
}

function SprintSnapshotSummary({
  sprint,
  isLoading,
}: {
  sprint: SprintListItem;
  isLoading: boolean;
}) {
  if (sprint.number == null) {
    return <span className="sprint-snapshot-empty">—</span>;
  }

  const tasks = sprint.taskSnapshot;
  const metrics = sprint.metricsSnapshot;

  if (!tasks && !metrics) {
    return <span className="sprint-snapshot-empty">No snapshot</span>;
  }

  const fetchedAt = tasks?.fetchedAt ?? metrics?.fetchedAt;

  return (
    <div className={`sprint-snapshot-summary${isLoading ? " is-loading" : ""}`}>
      <p className="sprint-snapshot-stats">
        {tasks ? (
          <>
            <strong>{tasks.taskCount}</strong> tasks
          </>
        ) : (
          <span className="sprint-snapshot-missing">no tasks</span>
        )}
        {" · "}
        {metrics ? (
          <>
            <strong>{metrics.metricsCount}</strong> metrics
          </>
        ) : (
          <span className="sprint-snapshot-missing">no metrics</span>
        )}
      </p>
      {fetchedAt && (
        <time className="sprint-snapshot-date" dateTime={fetchedAt}>
          Snapshot {formatSnapshotDate(fetchedAt)}
        </time>
      )}
      <div className="sprint-snapshot-badges">
        {isLoading && <span className="sprint-snapshot-loading">Updating…</span>}
      </div>
    </div>
  );
}

function positionActionsPanel(trigger: HTMLElement, panel: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const margin = 8;
  const minWidth = Math.max(rect.width, 184);

  panel.style.position = "fixed";
  panel.style.zIndex = "100";
  panel.style.minWidth = `${minWidth}px`;
  panel.style.maxWidth = `${Math.min(minWidth, window.innerWidth - margin * 2)}px`;
  panel.style.left = "auto";
  panel.style.right = `${Math.max(margin, window.innerWidth - rect.right)}px`;

  const panelHeight = panel.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const openUp = spaceBelow < panelHeight + gap && spaceAbove > spaceBelow;

  if (openUp) {
    panel.style.top = `${Math.max(margin, rect.top - panelHeight - gap)}px`;
    panel.dataset.placement = "top";
  } else {
    panel.style.top = `${Math.min(rect.bottom + gap, window.innerHeight - panelHeight - margin)}px`;
    panel.dataset.placement = "bottom";
  }
}

function resetActionsPanel(panel: HTMLElement) {
  panel.style.position = "";
  panel.style.top = "";
  panel.style.right = "";
  panel.style.left = "";
  panel.style.zIndex = "";
  panel.style.minWidth = "";
  panel.style.maxWidth = "";
  delete panel.dataset.placement;
}

function SprintActionsMenu({
  sprint,
  actions,
  isLoading,
  isExporting,
  isRetroBusy,
  onLoad,
  onExport,
  onRetro,
  onNavigate,
}: {
  sprint: SprintListItem;
  actions: SprintAction[];
  isLoading: boolean;
  isExporting: boolean;
  isRetroBusy: boolean;
  onLoad: () => void;
  onExport: () => void;
  onRetro: () => void;
  onNavigate: (to: string, search?: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const busy = isLoading || isExporting || isRetroBusy;
  const statusLabel = isExporting
    ? "Exporting sprint"
    : isLoading
      ? "Loading sprint"
      : isRetroBusy
        ? "Opening retro"
        : "Actions";

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!open || !trigger || !panel) {
      if (panel) {
        resetActionsPanel(panel);
      }
      return;
    }

    function updatePosition() {
      if (trigger && panel) {
        positionActionsPanel(trigger, panel);
      }
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      resetActionsPanel(panel);
    };
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (sprint.number == null || actions.length === 0) {
    return <span className="sprint-snapshot-empty">—</span>;
  }

  function runAction(action: SprintAction) {
    setOpen(false);
    switch (action.id) {
      case "load":
        onLoad();
        break;
      case "view-tasks":
        onNavigate("/tasks/compare", { sprints: [action.sprintNumber] });
        break;
      case "view-metrics":
        onNavigate("/sprint", { sprint: action.sprintNumber });
        break;
      case "export":
        onExport();
        break;
      case "retro":
        onRetro();
        break;
    }
  }

  return (
    <details
      className={`sprint-actions-menu${open ? " is-open" : ""}${busy ? " is-busy" : ""}`}
      open={open}
      onToggle={(event) => {
        const details = event.target as HTMLDetailsElement;
        if (busy) {
          details.open = false;
          setOpen(false);
          return;
        }
        setOpen(details.open);
      }}
    >
      <summary
        ref={triggerRef}
        className="sprint-btn sprint-btn-secondary sprint-actions-trigger"
        aria-label={`${statusLabel} sprint ${sprint.number}`}
        aria-busy={busy}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          if (busy) {
            event.preventDefault();
          }
        }}
      >
        <span className="sprint-actions-trigger-label">Actions</span>
      </summary>
      <div ref={panelRef} className="sprint-actions-menu-panel" role="menu">
        {actions.map((action) => (
          <button
            key={`${action.id}-${action.label}`}
            type="button"
            className="sprint-actions-menu-item"
            role="menuitem"
            disabled={busy}
            onClick={() => runAction(action)}
          >
            <span className="sprint-action-icon" aria-hidden="true">
              <SprintActionIcon name={action.icon} />
            </span>
            <span className="sprint-action-label">{action.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

function SprintRow({
  sprint,
  canWrite,
  onLoadSprint,
  onExport,
  onRetro,
  loadingSprint,
  exportingTarget,
  retroSprint,
  onNavigate,
}: {
  sprint: SprintListItem;
  canWrite: boolean;
  onLoadSprint: () => void;
  onExport: () => void;
  onRetro: () => void;
  loadingSprint: number | null;
  exportingTarget: ExportTarget | null;
  retroSprint: number | null;
  onNavigate: (to: string, search?: Record<string, unknown>) => void;
}) {
  const isLoadingSprint = sprint.number != null && loadingSprint === sprint.number;
  const isExporting =
    sprint.number != null &&
    exportingTarget?.kind === "sprint" &&
    exportingTarget.sprintNumber === sprint.number;
  const isRetroBusy = sprint.number != null && retroSprint === sprint.number;
  const actions = getSprintActions(sprint, canWrite);

  return (
    <tr className={sprint.state === "active" ? "sprint-row-active" : undefined}>
      <td>{sprint.number ?? "—"}</td>
      <td>
        {sprint.number != null ? (
          <Link to="/tasks/compare" search={{ sprints: [sprint.number] }}>
            {sprint.name}
          </Link>
        ) : (
          sprint.name
        )}
      </td>
      <td>
        <SprintStatePill state={sprint.state} />
      </td>
      <td>{formatDate(sprint.startDate)}</td>
      <td>{formatDate(sprint.endDate)}</td>
      <td>{formatDate(sprint.completeDate)}</td>
      <td className="sprint-snapshot-col">
        <SprintSnapshotSummary sprint={sprint} isLoading={isLoadingSprint} />
      </td>
      <td className="sprint-actions-col">
        <SprintActionsMenu
          sprint={sprint}
          actions={actions}
          isLoading={isLoadingSprint}
          isExporting={isExporting}
          isRetroBusy={isRetroBusy}
          onLoad={onLoadSprint}
          onExport={onExport}
          onRetro={onRetro}
          onNavigate={onNavigate}
        />
      </td>
    </tr>
  );
}

function SprintsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canWrite = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser?.role === "admin",
  });
  const [loadingSprint, setLoadingSprint] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingTarget, setExportingTarget] = useState<ExportTarget | null>(null);
  const [retroSprint, setRetroSprint] = useState<number | null>(null);
  const sprintsQuery = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    retry: false,
  });

  const { teamOnly } = useTeamMemberFilterContext();

  const loadSprintMutation = useMutation({
    mutationFn: (sprintNumber: number) => loadSprint(sprintNumber),
    onMutate: (sprintNumber) => {
      setLoadingSprint(sprintNumber);
      setError(null);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["sprint-metrics", data.sprintNumber], data.metrics);
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setLoadingSprint(null),
  });

  const sprints = sprintsQuery.data ?? [];
  const activeCount = sprints.filter((s) => s.state === "active").length;

  function navigateFromAction(to: string, search?: Record<string, unknown>) {
    navigate({ to, search } as Parameters<typeof navigate>[0]);
  }

  async function runExport(target: ExportTarget, action: () => Promise<void>) {
    setExportingTarget(target);
    setExportError(null);
    try {
      await action();
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExportingTarget(null);
    }
  }

  function exportSprint(sprintNumber: number) {
    void runExport({ kind: "sprint", sprintNumber }, () =>
      exportSprintFile(sprintNumber, teamOnly),
    );
  }

  async function openRetro(sprintNumber: number) {
    setRetroSprint(sprintNumber);
    setError(null);
    try {
      let session = await fetchRetroBySprint(sprintNumber);
      if (!session) {
        if (!canWrite) {
          throw new Error("No retro session yet. Ask an admin to start it.");
        }
        session = await createRetroSession(sprintNumber);
        queryClient.invalidateQueries({ queryKey: ["retros"] });
      }
      await navigate({
        to: "/retros/$sessionId",
        params: { sessionId: String(session.id) },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRetroSprint(null);
    }
  }

  if (sprintsQuery.isLoading) {
    return <p>Loading sprints...</p>;
  }

  if (sprintsQuery.isError) {
    return <p className="alert">{(sprintsQuery.error as Error).message}</p>;
  }

  return (
    <>
      <p className="meta-line meta-line-inline">
        {sprints.length} sprints
        {activeCount > 0 ? ` · ${activeCount} active` : ""}
      </p>

      <p className="meta-line">
        {canWrite
          ? "Load tasks and metrics in one step from Jira. Loading fetches changelogs and usually takes 1–3 minutes per sprint."
          : "Browse sprint snapshots and export Excel. Only admins can load or reload data from Jira."}
      </p>

      {error && <p className="alert">{error}</p>}
      {exportError && <p className="alert">{exportError}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
              <th>Completed</th>
              <th className="sprint-snapshot-col">Snapshot</th>
              <th className="sprint-actions-col" aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {sprints.map((sprint) => (
              <SprintRow
                key={sprint.id}
                sprint={sprint}
                canWrite={canWrite}
                onLoadSprint={() =>
                  sprint.number != null && loadSprintMutation.mutate(sprint.number)
                }
                onExport={() => sprint.number != null && exportSprint(sprint.number)}
                onRetro={() => sprint.number != null && void openRetro(sprint.number)}
                loadingSprint={loadingSprint}
                exportingTarget={exportingTarget}
                retroSprint={retroSprint}
                onNavigate={navigateFromAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
