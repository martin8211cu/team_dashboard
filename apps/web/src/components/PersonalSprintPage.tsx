import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  formatPeriodLabel,
  type UpsertFollowUpEvaluationInput,
} from "@team-dashboard/shared";
import { SelfEvaluationForm } from "./SelfEvaluationForm";
import { SelfEvaluationHistoryChart } from "./charts/SelfEvaluationHistoryChart";
import {
  fetchPersonalSprint,
  fetchMembers,
  fetchSprints,
  submitFollowUpSelfEvaluation,
  updateFollowUpSelfEvaluation,
} from "../lib/api";

function fmtDays(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(1);
}

type PersonalSprintPageProps = {
  memberId?: number;
};

export function PersonalSprintPage({ memberId }: PersonalSprintPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser,
  });
  const isAdmin = authUser?.role === "admin";
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sprintsQuery = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    retry: false,
  });

  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers(),
    enabled: Boolean(isAdmin),
  });

  const sprintOptions = useMemo(
    () =>
      (sprintsQuery.data ?? [])
        .filter((sprint) => sprint.number != null)
        .sort((a, b) => (b.number ?? 0) - (a.number ?? 0)),
    [sprintsQuery.data],
  );

  const defaultSprint = useMemo(() => {
    const active = sprintOptions.find((sprint) => sprint.state === "active");
    return active?.number ?? sprintOptions[0]?.number ?? null;
  }, [sprintOptions]);

  const sprintNumber = selectedSprint ?? defaultSprint;
  const viewMemberId = memberId ?? authUser?.id;

  const viewQuery = useQuery({
    queryKey: ["personal-sprint", viewMemberId, sprintNumber],
    queryFn: () =>
      fetchPersonalSprint({
        memberId: viewMemberId,
        sprint: sprintNumber ?? undefined,
      }),
    enabled: viewMemberId != null,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: (input: UpsertFollowUpEvaluationInput) =>
      submitFollowUpSelfEvaluation({
        ...input,
        period: viewQuery.data!.followUpPeriod,
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["personal-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-session"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const adminSaveMutation = useMutation({
    mutationFn: (input: UpsertFollowUpEvaluationInput) =>
      updateFollowUpSelfEvaluation(viewQuery.data!.member.id, viewQuery.data!.followUpPeriod, input),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["personal-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-session"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const view = viewQuery.data;
  const compareCards = view?.mine
    ? [
        {
          title: "Tickets",
          mine: String(view.mine.total),
          team: view.team ? String(view.team.total) : "—",
        },
        {
          title: "Avg lead (d)",
          mine: fmtDays(view.mine.avgLeadTime),
          team: view.team ? fmtDays(view.team.avgLeadTime) : "—",
        },
        {
          title: "Avg cycle (d)",
          mine: fmtDays(view.mine.avgCycleTime),
          team: view.team ? fmtDays(view.team.avgCycleTime) : "—",
        },
        {
          title: "WIP",
          mine: String(view.mine.wipCount),
          team: view.team ? String(view.team.wipCount) : "—",
        },
      ]
    : [];

  return (
    <div className="personal-sprint">
      <div className="personal-sprint-header">
        <div>
          <h2 className="personal-sprint-title">{view?.member.name ?? "My sprint"}</h2>
          <p className="meta-line meta-muted">
            Personal Alten tickets and metrics vs team average
          </p>
        </div>
        <div className="personal-sprint-controls">
          {isAdmin && (
            <label className="personal-sprint-select">
              <span>Member</span>
              <select
                value={viewMemberId ?? ""}
                onChange={(event) => {
                  const nextId = Number.parseInt(event.target.value, 10);
                  if (nextId === authUser?.id) {
                    void navigate({ to: "/me" });
                  } else {
                    void navigate({ to: "/me/$memberId", params: { memberId: String(nextId) } });
                  }
                }}
              >
                {(membersQuery.data ?? [])
                  .filter((member) => member.active)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="personal-sprint-select">
            <span>Sprint</span>
            <select
              value={sprintNumber ?? ""}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                setSelectedSprint(Number.isNaN(parsed) ? null : parsed);
              }}
            >
              {sprintOptions.map((sprint) => (
                <option key={sprint.number} value={sprint.number ?? ""}>
                  {sprint.name}
                  {sprint.state === "active" ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="alert">{error}</p>}
      {viewQuery.isLoading && <p>Loading personal sprint…</p>}
      {viewQuery.isError && <p className="alert">{(viewQuery.error as Error).message}</p>}

      {view && !view.sprint && (
        <p className="meta-muted">No sprint data available yet.</p>
      )}

      {view?.sprint && !view.sprint.hasMetricsSnapshot && (
        <p className="alert">
          No metrics snapshot for {view.sprint.name}. Ask an admin to load the sprint.
        </p>
      )}

      {view?.mine && (
        <div className="personal-compare-grid">
          {compareCards.map((card) => (
            <article key={card.title} className="personal-compare-card">
              <h3>{card.title}</h3>
              <p className="personal-compare-mine">{card.mine}</p>
              <p className="meta-muted">Team: {card.team}</p>
            </article>
          ))}
        </div>
      )}

      {view && view.selfEvaluationHistory.length > 0 && (
        <SelfEvaluationHistoryChart history={view.selfEvaluationHistory} />
      )}

      {view && (
        <div className="personal-self-eval">
          <SelfEvaluationForm
            period={view.followUpPeriod}
            value={view.selfEvaluation}
            canSubmit={view.canSubmitSelfEvaluation}
            canEdit={view.canEditSelfEvaluation}
            busy={submitMutation.isPending || adminSaveMutation.isPending}
            onSubmit={(input) => submitMutation.mutate(input)}
            onAdminSave={(input) => adminSaveMutation.mutate(input)}
          />
          {view.followUpSessionId != null && (
            <p className="meta-line">
              <Link to="/follow-up/$sessionId" params={{ sessionId: String(view.followUpSessionId) }}>
                Open Follow Up session ({formatPeriodLabel(view.followUpPeriod)})
              </Link>
            </p>
          )}
        </div>
      )}

      {view && (
        <section className="personal-tickets">
          <header className="follow-up-panel-header">
            <div>
              <h3>My tickets</h3>
              <p className="meta-line">
                {view.sprint?.name ?? "Sprint"} · {view.tickets.length} ticket
                {view.tickets.length === 1 ? "" : "s"}
              </p>
            </div>
          </header>
          {view.tickets.length === 0 ? (
            <p className="meta-muted">No Alten tickets for this member in the selected sprint.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Summary</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Lead</th>
                    <th>Cycle</th>
                  </tr>
                </thead>
                <tbody>
                  {view.tickets.map((ticket) => (
                    <tr key={ticket.key}>
                      <td>
                        <a href={ticket.url} target="_blank" rel="noreferrer">
                          {ticket.key}
                        </a>
                      </td>
                      <td>{ticket.summary}</td>
                      <td>{ticket.type}</td>
                      <td>{ticket.status}</td>
                      <td>{fmtDays(ticket.leadTimeDays)}</td>
                      <td>{fmtDays(ticket.cycleTimeDays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
