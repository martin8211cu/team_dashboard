import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  filterTasksByMembers,
  type MappedIssue,
  type SprintTasksResponse,
} from "@team-dashboard/shared";
import { StatusPill } from "../components/StatusPill";
import { useTeamMemberFilterContext } from "../components/TeamMemberFilterContext";
import { fetchSprintTasksCompare, summarizeTasks } from "../lib/api";
import { applyMemberFilter } from "../lib/memberFilter";

type CompareSearch = {
  sprints: number[];
};

export const Route = createFileRoute("/tasks/compare")({
  validateSearch: (search: Record<string, unknown>): CompareSearch => {
    const raw = search.sprints;
    const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
    const sprints = values
      .map((value) => Number.parseInt(String(value).trim(), 10))
      .filter((value) => !Number.isNaN(value) && value > 0);
    return { sprints };
  },
  component: ComparePage,
});

function TasksTable({
  tasks,
  showAltenAssignee,
}: {
  tasks: MappedIssue[];
  showAltenAssignee: boolean;
}) {
  if (tasks.length === 0) {
    return <p className="meta-line">No tasks with the current filter.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Summary</th>
            <th>{showAltenAssignee ? "Alten Assignee" : "Assignee"}</th>
            <th>Status</th>
            <th>SP</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.key}>
              <td>
                <a href={task.url} target="_blank" rel="noreferrer">
                  {task.key}
                </a>
              </td>
              <td className="summary-cell">{task.summary}</td>
              <td>{showAltenAssignee ? task.altenAssignees ?? "—" : task.assignee}</td>
              <td>
                <StatusPill status={task.status} />
              </td>
              <td>{task.storyPoints ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SprintSummaryCard({
  sprint,
  filteredTasks,
}: {
  sprint: SprintTasksResponse;
  filteredTasks: MappedIssue[];
}) {
  const summary = summarizeTasks(filteredTasks);

  return (
    <article className="compare-summary-card">
      <h3>{sprint.sprintName}</h3>
      <p className="meta-line">Snapshot: {sprint.fetchedAt.slice(0, 16).replace("T", " ")}</p>
      <ul className="compare-summary-stats">
        <li>
          <strong>{summary.total}</strong> tickets
        </li>
        <li>
          <strong>{summary.open}</strong> open
        </li>
        <li>
          <strong>{summary.closed}</strong> closed
        </li>
        <li>
          <strong>{summary.totalStoryPoints}</strong> SP
        </li>
      </ul>
      {summary.byStatus.length > 0 && (
        <ul className="breakdown-list">
          {summary.byStatus.slice(0, 4).map(({ status, count }) => (
            <li key={status}>
              <StatusPill status={status} /> {count}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ComparePage() {
  const { sprints: sprintNumbers } = Route.useSearch();
  const { teamOnly, filterMemberNames } = useTeamMemberFilterContext();

  const compareQuery = useQuery({
    queryKey: ["sprint-tasks-compare", sprintNumbers.join(",")],
    queryFn: () => fetchSprintTasksCompare(sprintNumbers),
    enabled: sprintNumbers.length > 0,
    retry: false,
  });

  const filteredSprints = useMemo(() => {
    if (!compareQuery.data) {
      return [];
    }

    return compareQuery.data.sprints.map((sprint) => ({
      sprint,
      tasks: applyMemberFilter(sprint.tasks, teamOnly, filterMemberNames, filterTasksByMembers),
    }));
  }, [compareQuery.data, teamOnly, filterMemberNames]);

  if (sprintNumbers.length === 0) {
    return (
      <>
        <p className="alert">Select at least one sprint from the sprints list.</p>
        <Link to="/sprints">Back to Sprints</Link>
      </>
    );
  }

  if (compareQuery.isLoading) {
    return <p>Loading comparison...</p>;
  }

  if (compareQuery.isError) {
    return (
      <>
        <p className="alert">{(compareQuery.error as Error).message}</p>
        <Link to="/sprints">Back to Sprints</Link>
      </>
    );
  }

  const data = compareQuery.data!;
  const isCompare = sprintNumbers.length >= 2;

  return (
    <>
      <div className="page-toolbar">
        <div className="section-header-actions">
          {!isCompare && sprintNumbers[0] != null && (
            <Link
              to="/sprint"
              search={{ sprint: sprintNumbers[0] }}
              className="sprint-btn sprint-btn-secondary section-header-link"
            >
              View metrics
            </Link>
          )}
          <Link to="/sprints" className="sprint-btn sprint-btn-secondary section-header-link">
            Back to Sprints
          </Link>
        </div>
      </div>

      {data.missing.length > 0 && (
        <p className="alert">
          Missing snapshots for sprints: {data.missing.join(", ")}. Load them from{" "}
          <Link to="/sprints">Sprints</Link>.
        </p>
      )}

      {filteredSprints.length === 0 && (
        <p className="meta-line">No snapshots available for the selected sprints.</p>
      )}

      {filteredSprints.length > 0 && (
        <>
          <div className="compare-summary-grid">
            {filteredSprints.map(({ sprint, tasks }) => (
              <SprintSummaryCard key={sprint.sprintNumber} sprint={sprint} filteredTasks={tasks} />
            ))}
          </div>

          {filteredSprints.map(({ sprint, tasks }) => (
            <section key={sprint.sprintNumber} className="compare-sprint-section">
              <h3>
                {sprint.sprintName}{" "}
                <span className="meta-line">
                  ({tasks.length} tickets{teamOnly ? " from the team" : ""})
                </span>
              </h3>
              <TasksTable tasks={tasks} showAltenAssignee={teamOnly} />
            </section>
          ))}
        </>
      )}
    </>
  );
}
