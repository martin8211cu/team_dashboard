import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { RetroCard, RetroColumn, RetroReaction } from "@team-dashboard/shared";
import { HiHandThumbDown, HiHandThumbUp, HiShare } from "react-icons/hi2";
import {
  closeRetroSession,
  createRetroCard,
  deleteRetroCard,
  fetchRetroSession,
  joinRetroSession,
  reopenRetroSession,
  toggleRetroCardReaction,
  updateRetroCard,
} from "../lib/api";

export const Route = createFileRoute("/retros/$sessionId")({
  component: RetroBoardPage,
});

const RETRO_CARD_MAX_LENGTH = 300;

const COLUMNS: { key: RetroColumn; title: string }[] = [
  { key: "went_well", title: "Went Well" },
  { key: "needs_improvement", title: "Needs Improvement" },
  { key: "action_items", title: "Action Items" },
];

function sessionShareUrl(sessionId: number): string {
  return `${window.location.origin}/retros/${sessionId}`;
}

function ShareSessionButton({
  sessionId,
  sprintNumber,
}: {
  sessionId: number;
  sprintNumber: number;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") {
      return;
    }
    const timer = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function share() {
    const url = sessionShareUrl(sessionId);
    const title = `Sprint ${sprintNumber} retrospective`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url, text: title });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
      } catch {
        setStatus("error");
      }
    }
  }

  return (
    <button
      type="button"
      className="sprint-btn sprint-btn-secondary retro-share-btn"
      onClick={() => void share()}
      aria-label="Share session link"
    >
      <HiShare aria-hidden="true" />
      <span>{status === "copied" ? "Link copied" : status === "error" ? "Copy failed" : "Share"}</span>
    </button>
  );
}

function RetroBoardPage() {
  const { sessionId: sessionIdParam } = Route.useParams();
  const sessionId = Number.parseInt(sessionIdParam, 10);
  const queryClient = useQueryClient();
  const authUser = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.authUser,
  });
  const isAdmin = authUser?.role === "admin";
  const [error, setError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["retro", sessionId],
    queryFn: () => fetchRetroSession(sessionId),
    enabled: Number.isInteger(sessionId) && sessionId > 0,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.joined || data.session.status !== "open") {
        return false;
      }
      return 3000;
    },
  });

  const joinMutation = useMutation({
    mutationFn: () => joinRetroSession(sessionId),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(["retro", sessionId], data);
      queryClient.invalidateQueries({ queryKey: ["retros"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeRetroSession(sessionId),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["retro", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["retros"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenRetroSession(sessionId),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["retro", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["retros"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return <p className="alert">Invalid session</p>;
  }

  if (detailQuery.isLoading) {
    return <p>Loading board...</p>;
  }

  if (detailQuery.isError) {
    return <p className="alert">{(detailQuery.error as Error).message}</p>;
  }

  const detail = detailQuery.data;
  if (!detail) {
    return <p className="alert">Session not found</p>;
  }

  const { session, cards, participants, joined } = detail;
  const isOpen = session.status === "open";

  if (!joined) {
    return (
      <div className="retro-join">
        <p className="meta-line">
          Sprint {session.sprintNumber} ·{" "}
          <span className={`status-pill retro-status-${session.status}`}>
            {session.status === "open" ? "Open" : "Closed"}
          </span>
        </p>
        <p>Join this retrospective to view and add cards.</p>
        {error && <p className="alert">{error}</p>}
        <div className="retro-join-actions">
          <button
            type="button"
            className="sprint-btn sprint-btn-primary"
            disabled={!isOpen || joinMutation.isPending}
            onClick={() => joinMutation.mutate()}
          >
            Join session
          </button>
          <ShareSessionButton sessionId={sessionId} sprintNumber={session.sprintNumber} />
          <Link to="/retros" className="sprint-btn sprint-btn-secondary">
            Back to list
          </Link>
        </div>
        {!isOpen && <p className="meta-muted">This session is closed. Ask an admin to reopen it.</p>}
      </div>
    );
  }

  const cardsByColumn = (column: RetroColumn) => cards.filter((card) => card.column === column);

  return (
    <div className="retro-board-page">
      <div className="retro-board-header">
        <div>
          <p className="meta-line meta-line-inline">
            Sprint {session.sprintNumber}
            {" · "}
            <span className={`status-pill retro-status-${session.status}`}>
              {session.status === "open" ? "Open" : "Closed"}
            </span>
            {" · "}
            {participants.length} participant{participants.length === 1 ? "" : "s"}
          </p>
          <p className="meta-muted retro-participants">
            {participants.map((p) => p.name).join(" · ") || "No participants yet"}
          </p>
        </div>
        <div className="retro-board-header-actions">
          <ShareSessionButton sessionId={sessionId} sprintNumber={session.sprintNumber} />
          <Link to="/retros" className="sprint-btn sprint-btn-secondary">
            All retros
          </Link>
          {isAdmin &&
            (isOpen ? (
              <button
                type="button"
                className="sprint-btn sprint-btn-secondary"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate()}
              >
                Close session
              </button>
            ) : (
              <button
                type="button"
                className="sprint-btn sprint-btn-primary"
                disabled={reopenMutation.isPending}
                onClick={() => reopenMutation.mutate()}
              >
                Reopen session
              </button>
            ))}
        </div>
      </div>

      {error && <p className="alert">{error}</p>}

      <div className="retro-board">
        {COLUMNS.map((column) => (
          <RetroColumnPanel
            key={column.key}
            sessionId={sessionId}
            column={column.key}
            title={column.title}
            cards={cardsByColumn(column.key)}
            isOpen={isOpen}
            isAdmin={isAdmin}
            currentUserId={authUser?.id}
            onError={setError}
          />
        ))}
      </div>
    </div>
  );
}

function RetroColumnPanel({
  sessionId,
  column,
  title,
  cards,
  isOpen,
  isAdmin,
  currentUserId,
  onError,
}: {
  sessionId: number;
  column: RetroColumn;
  title: string;
  cards: RetroCard[];
  isOpen: boolean;
  isAdmin: boolean;
  currentUserId: number | undefined;
  onError: (message: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const canAdd =
    isOpen && (column !== "action_items" || isAdmin);

  const addMutation = useMutation({
    mutationFn: () => createRetroCard(sessionId, { column, body: draft }),
    onSuccess: () => {
      onError(null);
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["retro", sessionId] });
    },
    onError: (err: Error) => onError(err.message),
  });

  return (
    <section className={`retro-column retro-column-${column}`}>
      <header className="retro-column-header">
        <h2>{title}</h2>
        <span className="retro-column-count">{cards.length}</span>
      </header>

      <ul className="retro-card-list">
        {cards.map((card) => (
          <RetroCardItem
            key={card.id}
            sessionId={sessionId}
            card={card}
            isOpen={isOpen}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onError={onError}
          />
        ))}
      </ul>

      {canAdd && (
        <form
          className="retro-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) {
              return;
            }
            addMutation.mutate();
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, RETRO_CARD_MAX_LENGTH))}
            placeholder="Add a card…"
            rows={3}
            maxLength={RETRO_CARD_MAX_LENGTH}
            disabled={addMutation.isPending}
          />
          <button
            type="submit"
            className="sprint-btn sprint-btn-primary"
            disabled={!draft.trim() || addMutation.isPending}
          >
            Add
          </button>
        </form>
      )}

      {!canAdd && column === "action_items" && !isAdmin && (
        <p className="meta-muted retro-column-hint">Only admins can add Action Items.</p>
      )}
    </section>
  );
}

function RetroCardItem({
  sessionId,
  card,
  isOpen,
  isAdmin,
  currentUserId,
  onError,
}: {
  sessionId: number;
  card: RetroCard;
  isOpen: boolean;
  isAdmin: boolean;
  currentUserId: number | undefined;
  onError: (message: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(card.body);

  const isOwner =
    currentUserId != null && Number(card.authorId) === Number(currentUserId);
  const isOwnerOrAdmin = isAdmin || isOwner;
  // Only card author or admin may edit/delete.
  const canEdit = isOpen && isOwnerOrAdmin;
  const canDelete = (isOpen || isAdmin) && isOwnerOrAdmin;

  const saveMutation = useMutation({
    mutationFn: () => updateRetroCard(sessionId, card.id, body),
    onSuccess: () => {
      onError(null);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["retro", sessionId] });
    },
    onError: (err: Error) => onError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRetroCard(sessionId, card.id),
    onSuccess: () => {
      onError(null);
      queryClient.invalidateQueries({ queryKey: ["retro", sessionId] });
    },
    onError: (err: Error) => onError(err.message),
  });

  const reactionMutation = useMutation({
    mutationFn: (reaction: RetroReaction) =>
      toggleRetroCardReaction(sessionId, card.id, reaction),
    onSuccess: () => {
      onError(null);
      queryClient.invalidateQueries({ queryKey: ["retro", sessionId] });
    },
    onError: (err: Error) => onError(err.message),
  });

  return (
    <li className="retro-card">
      {editing ? (
        <form
          className="retro-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!body.trim()) {
              return;
            }
            saveMutation.mutate();
          }}
        >
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, RETRO_CARD_MAX_LENGTH))}
            rows={3}
            maxLength={RETRO_CARD_MAX_LENGTH}
            disabled={saveMutation.isPending}
          />
          <div className="retro-card-actions">
            <button
              type="submit"
              className="sprint-btn sprint-btn-primary"
              disabled={!body.trim() || saveMutation.isPending}
            >
              Save
            </button>
            <button
              type="button"
              className="sprint-btn sprint-btn-secondary"
              disabled={saveMutation.isPending}
              onClick={() => {
                setBody(card.body);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="retro-card-body">{card.body}</p>
          <div className="retro-card-meta">
            <span>{card.authorName}</span>
            {(canEdit || canDelete) && (
              <div className="retro-card-actions">
                {canEdit && (
                  <button
                    type="button"
                    className="retro-card-action"
                    onClick={() => {
                      setBody(card.body);
                      setEditing(true);
                    }}
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="retro-card-action retro-card-action-danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="retro-card-reactions" role="group" aria-label="Reactions">
            <button
              type="button"
              className={`retro-reaction-btn${card.myReaction === "like" ? " is-active" : ""}`}
              aria-pressed={card.myReaction === "like"}
              aria-label={`Like${card.likeCount ? `, ${card.likeCount}` : ""}`}
              disabled={!isOpen || reactionMutation.isPending}
              onClick={() => reactionMutation.mutate("like")}
            >
              <HiHandThumbUp aria-hidden="true" />
              <span>{card.likeCount}</span>
            </button>
            <button
              type="button"
              className={`retro-reaction-btn${card.myReaction === "dislike" ? " is-active" : ""}`}
              aria-pressed={card.myReaction === "dislike"}
              aria-label={`Dislike${card.dislikeCount ? `, ${card.dislikeCount}` : ""}`}
              disabled={!isOpen || reactionMutation.isPending}
              onClick={() => reactionMutation.mutate("dislike")}
            >
              <HiHandThumbDown aria-hidden="true" />
              <span>{card.dislikeCount}</span>
            </button>
          </div>
        </>
      )}
    </li>
  );
}
