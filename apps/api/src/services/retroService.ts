import type {
  AuthUser,
  CreateRetroCardInput,
  RetroCard,
  RetroColumn,
  RetroParticipant,
  RetroReaction,
  RetroSessionDetail,
  RetroSessionSummary,
  RetroWritingTimer,
} from "@team-dashboard/shared";
import {
  clearCardReaction,
  createCard,
  createRetroSession,
  deleteCard,
  getCardById,
  getCardReactionSummary,
  getMemberReaction,
  getRetroSessionById,
  getRetroSessionBySprint,
  getSessionCounts,
  isParticipant,
  joinRetroSession,
  listCards,
  listParticipants,
  listReactionSummariesForSession,
  listRetroSessions,
  RETRO_WRITING_TIMER_DURATION_SEC,
  setCardReaction,
  setRetroSessionStatus,
  updateWritingTimer,
  type CardReactionSummary,
  type RetroCardRow,
  type RetroSessionRow,
  updateCardBody,
} from "../db/retros";

const RETRO_REACTIONS = new Set<RetroReaction>(["like", "dislike"]);

const RETRO_COLUMNS = new Set<RetroColumn>([
  "went_well",
  "needs_improvement",
  "action_items",
]);

export const RETRO_CARD_MAX_LENGTH = 300;

/** Plain-text only: strip markup/control chars to reduce injection risk. */
export function sanitizeCardBody(raw: string): string {
  let text = raw.normalize("NFC");
  // Remove HTML/XML tags (repeatedly in case of nested/broken markup).
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(/<\/?[^>\n]*>/g, "");
  }
  // Neutralize leftover angle brackets and common entity openers.
  text = text.replace(/[<>]/g, "");
  text = text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, " ");
  // Drop null bytes and control chars except tab/newline.
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  text = text.replace(/\r\n?/g, "\n");
  // Collapse runs of spaces/tabs per line; trim overall.
  text = text
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trimEnd())
    .join("\n")
    .trim();
  return text;
}

function normalizeCardBody(raw: string): string {
  const body = sanitizeCardBody(typeof raw === "string" ? raw : "");
  if (!body) {
    throw new RetroError("Card body is required", 400);
  }
  if (body.length > RETRO_CARD_MAX_LENGTH) {
    throw new RetroError(`Card body must be at most ${RETRO_CARD_MAX_LENGTH} characters`, 400);
  }
  return body;
}

export class RetroError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RetroError";
    this.status = status;
  }
}

function tsIso(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function writingTimerRemainingSeconds(row: RetroSessionRow): number {
  const stored =
    row.writing_timer_seconds_left ?? RETRO_WRITING_TIMER_DURATION_SEC;
  if (row.writing_timer_started_at == null) {
    return stored;
  }
  const startedMs = new Date(row.writing_timer_started_at).getTime();
  const elapsedSec = Math.floor((Date.now() - startedMs) / 1000);
  return Math.max(0, stored - elapsedSec);
}

function writingTimerFromRow(row: RetroSessionRow): RetroWritingTimer {
  const running = row.writing_timer_started_at != null;
  return {
    durationSeconds: RETRO_WRITING_TIMER_DURATION_SEC,
    remainingSeconds: writingTimerRemainingSeconds(row),
    running,
    startedAt: running ? tsIso(row.writing_timer_started_at) : null,
  };
}

async function toSummary(
  row: RetroSessionRow,
  counts?: { participant_count: number; card_count: number },
): Promise<RetroSessionSummary> {
  const resolved = counts ?? (await getSessionCounts(row.id));
  return {
    id: row.id,
    sprintNumber: row.sprint_number,
    status: row.status,
    createdBy: row.created_by,
    createdAt: tsIso(row.created_at)!,
    closedAt: tsIso(row.closed_at),
    participantCount: resolved.participant_count,
    cardCount: resolved.card_count,
    writingTimer: writingTimerFromRow(row),
  };
}

async function assertAdminOpenSession(id: number, user: AuthUser): Promise<RetroSessionRow> {
  if (user.role !== "admin") {
    throw new RetroError("Admin role required", 403);
  }
  const session = await requireSession(id);
  if (session.status !== "open") {
    throw new RetroError("Session must be open", 400);
  }
  return session;
}

function emptyReactions(): Pick<RetroCard, "likeCount" | "dislikeCount" | "myReaction"> {
  return { likeCount: 0, dislikeCount: 0, myReaction: null };
}

function reactionsFromSummary(
  summary: CardReactionSummary | undefined,
): Pick<RetroCard, "likeCount" | "dislikeCount" | "myReaction"> {
  if (!summary) {
    return emptyReactions();
  }
  return {
    likeCount: Number(summary.like_count) || 0,
    dislikeCount: Number(summary.dislike_count) || 0,
    myReaction: summary.my_reaction,
  };
}

function toCard(
  row: RetroCardRow,
  reactions: Pick<RetroCard, "likeCount" | "dislikeCount" | "myReaction"> = emptyReactions(),
): RetroCard {
  return {
    id: row.id,
    sessionId: row.session_id,
    column: row.column_key,
    body: row.body,
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: tsIso(row.created_at)!,
    updatedAt: tsIso(row.updated_at)!,
    ...reactions,
  };
}

async function toCardForUser(row: RetroCardRow, userId: number): Promise<RetroCard> {
  return toCard(row, reactionsFromSummary(await getCardReactionSummary(row.id, userId)));
}

function toParticipant(row: {
  member_id: number;
  name: string;
  email: string | null;
  joined_at: Date | string;
}): RetroParticipant {
  return {
    memberId: row.member_id,
    name: row.name,
    email: row.email,
    joinedAt: tsIso(row.joined_at)!,
  };
}

async function requireSession(id: number): Promise<RetroSessionRow> {
  const session = await getRetroSessionById(id);
  if (!session) {
    throw new RetroError("Retro session not found", 404);
  }
  return session;
}

async function assertCanView(sessionId: number, user: AuthUser): Promise<void> {
  if (user.role === "admin") {
    return;
  }
  if (!(await isParticipant(sessionId, user.id))) {
    throw new RetroError("Join the session to view the board", 403);
  }
}

async function assertJoined(sessionId: number, user: AuthUser): Promise<void> {
  if (user.role === "admin") {
    return;
  }
  if (!(await isParticipant(sessionId, user.id))) {
    throw new RetroError("Join the session first", 403);
  }
}

export async function listSessions(): Promise<RetroSessionSummary[]> {
  const rows = await listRetroSessions();
  return Promise.all(
    rows.map((row) =>
      toSummary(row, {
        participant_count: row.participant_count,
        card_count: row.card_count,
      }),
    ),
  );
}

export async function getSessionBySprint(
  sprintNumber: number,
): Promise<RetroSessionSummary | null> {
  const row = await getRetroSessionBySprint(sprintNumber);
  return row ? toSummary(row) : null;
}

export async function createSession(
  sprintNumber: number,
  user: AuthUser,
): Promise<RetroSessionSummary> {
  if (user.role !== "admin") {
    throw new RetroError("Admin role required", 403);
  }
  if (!Number.isInteger(sprintNumber) || sprintNumber <= 0) {
    throw new RetroError("Valid sprintNumber is required", 400);
  }

  const existing = await getRetroSessionBySprint(sprintNumber);
  if (existing) {
    throw new RetroError(`Retro session already exists for sprint ${sprintNumber}`, 409);
  }

  const row = await createRetroSession(sprintNumber, user.id);
  await joinRetroSession(row.id, user.id);
  return toSummary(row);
}

export async function closeSession(id: number, user: AuthUser): Promise<RetroSessionSummary> {
  if (user.role !== "admin") {
    throw new RetroError("Admin role required", 403);
  }
  const session = await requireSession(id);
  if (session.status === "closed") {
    return toSummary(session);
  }
  const updated = await setRetroSessionStatus(id, "closed");
  return toSummary(updated!);
}

export async function reopenSession(id: number, user: AuthUser): Promise<RetroSessionSummary> {
  if (user.role !== "admin") {
    throw new RetroError("Admin role required", 403);
  }
  await requireSession(id);
  const updated = await setRetroSessionStatus(id, "open");
  return toSummary(updated!);
}

export async function startWritingTimer(
  id: number,
  user: AuthUser,
): Promise<RetroSessionSummary> {
  const session = await assertAdminOpenSession(id, user);
  if (session.writing_timer_started_at != null) {
    return toSummary(session);
  }
  const remaining = writingTimerRemainingSeconds(session);
  const updated = await updateWritingTimer(id, {
    writing_timer_seconds_left: remaining,
    writing_timer_started_at: new Date().toISOString(),
  });
  return toSummary(updated!);
}

export async function stopWritingTimer(
  id: number,
  user: AuthUser,
): Promise<RetroSessionSummary> {
  const session = await assertAdminOpenSession(id, user);
  if (session.writing_timer_started_at == null) {
    return toSummary(session);
  }
  const remaining = writingTimerRemainingSeconds(session);
  const updated = await updateWritingTimer(id, {
    writing_timer_seconds_left: remaining,
    writing_timer_started_at: null,
  });
  return toSummary(updated!);
}

export async function resetWritingTimer(
  id: number,
  user: AuthUser,
): Promise<RetroSessionSummary> {
  await assertAdminOpenSession(id, user);
  const updated = await updateWritingTimer(id, {
    writing_timer_seconds_left: RETRO_WRITING_TIMER_DURATION_SEC,
    writing_timer_started_at: null,
  });
  return toSummary(updated!);
}

export async function joinSession(id: number, user: AuthUser): Promise<RetroSessionDetail> {
  const session = await requireSession(id);
  if (session.status === "closed" && user.role !== "admin") {
    throw new RetroError("Session is closed", 403);
  }
  await joinRetroSession(id, user.id);
  return getSessionDetail(id, user);
}

export async function getSessionDetail(id: number, user: AuthUser): Promise<RetroSessionDetail> {
  const session = await requireSession(id);
  const joined = user.role === "admin" || (await isParticipant(id, user.id));
  if (!joined) {
    return {
      session: await toSummary(session),
      participants: [],
      cards: [],
      joined: false,
    };
  }

  await assertCanView(id, user);

  const reactionByCard = new Map(
    (await listReactionSummariesForSession(id, user.id)).map((row) => [row.card_id, row]),
  );

  return {
    session: await toSummary(session),
    participants: (await listParticipants(id)).map(toParticipant),
    cards: (await listCards(id)).map((row) =>
      toCard(row, reactionsFromSummary(reactionByCard.get(row.id))),
    ),
    joined: true,
  };
}

export async function addCard(
  sessionId: number,
  input: CreateRetroCardInput,
  user: AuthUser,
): Promise<RetroCard> {
  const session = await requireSession(sessionId);
  if (session.status === "closed") {
    throw new RetroError("Session is closed", 403);
  }
  await assertJoined(sessionId, user);

  if (!RETRO_COLUMNS.has(input.column)) {
    throw new RetroError("Invalid column", 400);
  }

  const body = normalizeCardBody(input.body);

  if (input.column === "action_items" && user.role !== "admin") {
    throw new RetroError("Only admin can add Action Items", 403);
  }

  const created = await createCard(sessionId, input.column, body, user.id);
  return toCardForUser(created, user.id);
}

export async function editCard(
  sessionId: number,
  cardId: number,
  bodyRaw: string,
  user: AuthUser,
): Promise<RetroCard> {
  const session = await requireSession(sessionId);
  if (session.status === "closed") {
    throw new RetroError("Session is closed", 403);
  }
  await assertJoined(sessionId, user);

  const card = await getCardById(cardId);
  if (!card || card.session_id !== sessionId) {
    throw new RetroError("Card not found", 404);
  }

  if (user.role !== "admin" && card.author_id !== user.id) {
    throw new RetroError("Only the author or an admin can edit this card", 403);
  }

  const body = normalizeCardBody(bodyRaw);

  const updated = await updateCardBody(cardId, body);
  return toCardForUser(updated!, user.id);
}

export async function toggleCardReaction(
  sessionId: number,
  cardId: number,
  reaction: RetroReaction,
  user: AuthUser,
): Promise<RetroCard> {
  const session = await requireSession(sessionId);
  if (session.status === "closed") {
    throw new RetroError("Session is closed", 403);
  }
  await assertJoined(sessionId, user);

  if (!RETRO_REACTIONS.has(reaction)) {
    throw new RetroError("Invalid reaction", 400);
  }

  const card = await getCardById(cardId);
  if (!card || card.session_id !== sessionId) {
    throw new RetroError("Card not found", 404);
  }

  const current = await getMemberReaction(cardId, user.id);
  if (current === reaction) {
    await clearCardReaction(cardId, user.id);
  } else {
    await setCardReaction(cardId, user.id, reaction);
  }

  return toCardForUser(card, user.id);
}

export async function removeCard(sessionId: number, cardId: number, user: AuthUser): Promise<void> {
  const session = await requireSession(sessionId);
  if (session.status === "closed" && user.role !== "admin") {
    throw new RetroError("Session is closed", 403);
  }
  await assertJoined(sessionId, user);

  const card = await getCardById(cardId);
  if (!card || card.session_id !== sessionId) {
    throw new RetroError("Card not found", 404);
  }

  if (user.role !== "admin" && card.author_id !== user.id) {
    throw new RetroError("Only the author or an admin can delete this card", 403);
  }

  await deleteCard(cardId);
}
