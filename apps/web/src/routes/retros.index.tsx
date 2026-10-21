import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { RetroSessionSummary, SprintListItem } from "@team-dashboard/shared";
import {
  createRetroSession,
  fetchRetroSessions,
  fetchSprints,
} from "../lib/api";

export const Route = createFileRoute("/retros/")({
  component: RetrosPage,
});

function RetrosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser?.role === "admin",
  });
  const [error, setError] = useState<string | null>(null);

  const sprintsQuery = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    retry: false,
  });

  const retrosQuery = useQuery({
    queryKey: ["retros"],
    queryFn: fetchRetroSessions,
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: (sprintNumber: number) => createRetroSession(sprintNumber),
    onSuccess: (session) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["retros"] });
      void navigate({ to: "/retros/$sessionId", params: { sessionId: String(session.id) } });
    },
    onError: (err: Error) => setError(err.message),
  });

  const sessionBySprint = useMemo(() => {
    const map = new Map<number, RetroSessionSummary>();
    for (const session of retrosQuery.data ?? []) {
      map.set(session.sprintNumber, session);
    }
    return map;
  }, [retrosQuery.data]);

  const sprints = useMemo(() => {
    const list = (sprintsQuery.data ?? []).filter(
      (sprint): sprint is SprintListItem & { number: number } => sprint.number != null,
    );
    return [...list].sort((a, b) => b.number - a.number);
  }, [sprintsQuery.data]);

  if (sprintsQuery.isLoading || retrosQuery.isLoading) {
    return <p>Loading retrospectives...</p>;
  }

  if (sprintsQuery.isError) {
    return <p className="alert">{(sprintsQuery.error as Error).message}</p>;
  }

  if (retrosQuery.isError) {
    return <p className="alert">{(retrosQuery.error as Error).message}</p>;
  }

  return (
    <>
      <p className="meta-line">
        One retrospective session per sprint. Join a board to add cards; only admins manage Action
        Items.
      </p>

      {error && <p className="alert">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sprint</th>
              <th>Name</th>
              <th>Retro</th>
              <th>Participants</th>
              <th>Cards</th>
              <th aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {sprints.map((sprint) => {
              const session = sessionBySprint.get(sprint.number);
              return (
                <tr key={sprint.id}>
                  <td>{sprint.number}</td>
                  <td>{sprint.name}</td>
                  <td>
                    {session ? (
                      <span
                        className={`status-pill retro-status-${session.status}`}
                      >
                        {session.status === "open" ? "Open" : "Closed"}
                      </span>
                    ) : (
                      <span className="meta-muted">No session</span>
                    )}
                  </td>
                  <td>{session?.participantCount ?? "—"}</td>
                  <td>{session?.cardCount ?? "—"}</td>
                  <td className="retro-list-actions">
                    {session ? (
                      <Link
                        to="/retros/$sessionId"
                        params={{ sessionId: String(session.id) }}
                        className="sprint-btn sprint-btn-secondary"
                      >
                        Open board
                      </Link>
                    ) : isAdmin ? (
                      <button
                        type="button"
                        className="sprint-btn sprint-btn-primary"
                        disabled={startMutation.isPending}
                        onClick={() => startMutation.mutate(sprint.number)}
                      >
                        Start retro
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
    </>
  );
}
