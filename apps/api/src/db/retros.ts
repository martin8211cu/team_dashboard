import { getDb } from "@team-dashboard/db";

export type RetroSessionStatus = "open" | "closed";
export type RetroColumn = "went_well" | "needs_improvement" | "action_items";
export type RetroReaction = "like" | "dislike";

export const RETRO_WRITING_TIMER_DURATION_SEC = 180;

export type RetroSessionRow = {
  id: number;
  sprint_number: number;
  status: RetroSessionStatus;
  created_by: number;
  created_at: Date | string;
  closed_at: Date | string | null;
  writing_timer_seconds_left: number;
  writing_timer_started_at: Date | string | null;
};

export type RetroParticipantRow = {
  session_id: number;
  member_id: number;
  joined_at: Date | string;
  name: string;
  email: string | null;
};

export type RetroCardRow = {
  id: number;
  session_id: number;
  column_key: RetroColumn;
  body: string;
  author_id: number;
  author_name: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

export async function listRetroSessions(): Promise<
  Array<RetroSessionRow & { participant_count: number; card_count: number }>
> {
  const result = await getDb().raw(
    `SELECT s.*,
        (SELECT COUNT(*)::int FROM retro_participants p WHERE p.session_id = s.id) AS participant_count,
        (SELECT COUNT(*)::int FROM retro_cards c WHERE c.session_id = s.id) AS card_count
       FROM retro_sessions s
       ORDER BY s.sprint_number DESC`,
  );
  return result.rows as Array<
    RetroSessionRow & { participant_count: number; card_count: number }
  >;
}

export async function getRetroSessionById(id: number): Promise<RetroSessionRow | null> {
  const row = await getDb()("retro_sessions").where({ id }).first<RetroSessionRow>();
  return row ?? null;
}

export async function getRetroSessionBySprint(sprintNumber: number): Promise<RetroSessionRow | null> {
  const row = await getDb()("retro_sessions")
    .where({ sprint_number: sprintNumber })
    .first<RetroSessionRow>();
  return row ?? null;
}

export async function createRetroSession(
  sprintNumber: number,
  createdBy: number,
): Promise<RetroSessionRow> {
  const [inserted] = await getDb()("retro_sessions")
    .insert({ sprint_number: sprintNumber, status: "open", created_by: createdBy })
    .returning<RetroSessionRow[]>("*");
  return inserted!;
}

export async function setRetroSessionStatus(
  id: number,
  status: RetroSessionStatus,
): Promise<RetroSessionRow | null> {
  if (status === "closed") {
    await getDb()("retro_sessions")
      .where({ id })
      .update({ status, closed_at: getDb().fn.now(), writing_timer_started_at: null });
  } else {
    await getDb()("retro_sessions").where({ id }).update({ status, closed_at: null });
  }
  return getRetroSessionById(id);
}

export async function updateWritingTimer(
  id: number,
  patch: {
    writing_timer_seconds_left: number;
    writing_timer_started_at: Date | string | null;
  },
): Promise<RetroSessionRow | null> {
  await getDb()("retro_sessions").where({ id }).update(patch);
  return getRetroSessionById(id);
}

export async function isParticipant(sessionId: number, memberId: number): Promise<boolean> {
  const row = await getDb()("retro_participants")
    .where({ session_id: sessionId, member_id: memberId })
    .count<{ count: string }>("* as count")
    .first();
  return Number(row?.count ?? 0) > 0;
}

export async function joinRetroSession(sessionId: number, memberId: number): Promise<void> {
  await getDb()("retro_participants")
    .insert({ session_id: sessionId, member_id: memberId })
    .onConflict(["session_id", "member_id"])
    .ignore();
}

export async function listParticipants(sessionId: number): Promise<RetroParticipantRow[]> {
  const rows = await getDb()("retro_participants as p")
    .join("team_members as m", "m.id", "p.member_id")
    .where("p.session_id", sessionId)
    .select<RetroParticipantRow[]>(
      "p.session_id",
      "p.member_id",
      "p.joined_at",
      "m.name",
      "m.email",
    )
    .orderBy("p.joined_at", "asc");
  return rows;
}

export async function listCards(sessionId: number): Promise<RetroCardRow[]> {
  const rows = await getDb()("retro_cards as c")
    .join("team_members as m", "m.id", "c.author_id")
    .where("c.session_id", sessionId)
    .select<RetroCardRow[]>(
      "c.id",
      "c.session_id",
      "c.column_key",
      "c.body",
      "c.author_id",
      "m.name as author_name",
      "c.created_at",
      "c.updated_at",
    )
    .orderBy("c.created_at", "asc");
  return rows;
}

export async function getCardById(cardId: number): Promise<RetroCardRow | null> {
  const row = await getDb()("retro_cards as c")
    .join("team_members as m", "m.id", "c.author_id")
    .where("c.id", cardId)
    .select<RetroCardRow>(
      "c.id",
      "c.session_id",
      "c.column_key",
      "c.body",
      "c.author_id",
      "m.name as author_name",
      "c.created_at",
      "c.updated_at",
    )
    .first();
  return row ?? null;
}

export async function createCard(
  sessionId: number,
  column: RetroColumn,
  body: string,
  authorId: number,
): Promise<RetroCardRow> {
  const [inserted] = await getDb()("retro_cards")
    .insert({ session_id: sessionId, column_key: column, body, author_id: authorId })
    .returning<{ id: number }[]>("id");
  return (await getCardById(inserted!.id))!;
}

export async function updateCardBody(cardId: number, body: string): Promise<RetroCardRow | null> {
  await getDb()("retro_cards")
    .where({ id: cardId })
    .update({ body, updated_at: getDb().fn.now() });
  return getCardById(cardId);
}

export async function deleteCard(cardId: number): Promise<boolean> {
  const count = await getDb()("retro_cards").where({ id: cardId }).del();
  return count > 0;
}

export async function getSessionCounts(sessionId: number): Promise<{
  participant_count: number;
  card_count: number;
}> {
  const participants = await getDb()("retro_participants")
    .where({ session_id: sessionId })
    .count<{ count: string }>("* as count")
    .first();
  const cards = await getDb()("retro_cards")
    .where({ session_id: sessionId })
    .count<{ count: string }>("* as count")
    .first();
  return {
    participant_count: Number(participants?.count ?? 0),
    card_count: Number(cards?.count ?? 0),
  };
}

export type CardReactionSummary = {
  card_id: number;
  like_count: number;
  dislike_count: number;
  my_reaction: RetroReaction | null;
};

export async function listReactionSummariesForSession(
  sessionId: number,
  memberId: number,
): Promise<CardReactionSummary[]> {
  const result = await getDb().raw(
    `SELECT c.id AS card_id,
        COALESCE(SUM(CASE WHEN r.reaction = 'like' THEN 1 ELSE 0 END), 0)::int AS like_count,
        COALESCE(SUM(CASE WHEN r.reaction = 'dislike' THEN 1 ELSE 0 END), 0)::int AS dislike_count,
        (
          SELECT r2.reaction FROM retro_card_reactions r2
          WHERE r2.card_id = c.id AND r2.member_id = ?
          LIMIT 1
        ) AS my_reaction
       FROM retro_cards c
       LEFT JOIN retro_card_reactions r ON r.card_id = c.id
       WHERE c.session_id = ?
       GROUP BY c.id`,
    [memberId, sessionId],
  );
  return result.rows as CardReactionSummary[];
}

export async function getCardReactionSummary(
  cardId: number,
  memberId: number,
): Promise<CardReactionSummary> {
  const counts = await getDb().raw(
    `SELECT
        COALESCE(SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END), 0)::int AS like_count,
        COALESCE(SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END), 0)::int AS dislike_count
       FROM retro_card_reactions
       WHERE card_id = ?`,
    [cardId],
  );

  const row = counts.rows[0];
  return {
    card_id: cardId,
    like_count: row?.like_count ?? 0,
    dislike_count: row?.dislike_count ?? 0,
    my_reaction: await getMemberReaction(cardId, memberId),
  };
}

export async function getMemberReaction(
  cardId: number,
  memberId: number,
): Promise<RetroReaction | null> {
  const row = await getDb()("retro_card_reactions")
    .where({ card_id: cardId, member_id: memberId })
    .select<{ reaction: RetroReaction }>("reaction")
    .first();
  return row?.reaction ?? null;
}

export async function setCardReaction(
  cardId: number,
  memberId: number,
  reaction: RetroReaction,
): Promise<void> {
  await getDb()("retro_card_reactions")
    .insert({ card_id: cardId, member_id: memberId, reaction })
    .onConflict(["card_id", "member_id"])
    .merge({ reaction });
}

export async function clearCardReaction(cardId: number, memberId: number): Promise<void> {
  await getDb()("retro_card_reactions").where({ card_id: cardId, member_id: memberId }).del();
}
