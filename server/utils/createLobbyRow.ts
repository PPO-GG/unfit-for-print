// server/utils/createLobbyRow.ts
// Inserts a lobby row with its host seated. Shared by lobby/create and
// lobby/activity-play so the two cannot drift apart.

import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { lobbies, players, users } from "../db/schema";

/** The pooled db or an open transaction — both can run these inserts. */
type DbExecutor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface NewLobbyOptions {
  lobbyName?: string;
  discordInstanceId?: string;
  discordChannelId?: string;
  /** Hidden from the public browser. Defaults to false. */
  vcOnly?: boolean;
  /** Defaults to true. */
  isPrivate?: boolean;
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

/**
 * Creates the lobby and its host's player row. Does not record activity
 * events: callers do that once the write is committed, so a rolled-back
 * transaction never counts as a created lobby.
 */
export async function createLobbyRow(
  db: DbExecutor,
  host: Pick<typeof users.$inferSelect, "id" | "name" | "avatarUrl">,
  options: NewLobbyOptions,
) {
  let code = randomCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const [existing] = await db
      .select({ id: lobbies.id })
      .from(lobbies)
      .where(eq(lobbies.code, code));
    if (!existing) break;
    code = randomCode();
  }

  const [lobby] = await db
    .insert(lobbies)
    .values({
      code,
      hostUserId: host.id,
      lobbyName: options.lobbyName,
      discordInstanceId: options.discordInstanceId,
      discordChannelId: options.discordChannelId,
      vcOnly: options.vcOnly ?? false,
      isPrivate: options.isPrivate ?? true,
    })
    .returning();

  if (!lobby) {
    throw createError({ statusCode: 500, statusMessage: "Failed to create lobby" });
  }

  await db.insert(players).values({
    userId: host.id,
    lobbyId: lobby.id,
    name: host.name,
    avatar: host.avatarUrl,
    isHost: true,
    playerType: "player",
  });

  return lobby;
}
