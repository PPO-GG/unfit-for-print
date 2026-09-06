import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, lobbyPasswords } from "~~/server/db/schema";

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");
  const db = useDb();
  const [lobby] = await db
    .select()
    .from(lobbies)
    .where(eq(lobbies.code, code!))
    .limit(1);
  if (!lobby) return null;

  // Whether a password is required, never anything about the password itself.
  // The join form needs this to know whether to prompt; the hash lives in its
  // own table precisely so a bare select() like the one above cannot ship it.
  const [pw] = await db
    .select({ lobbyId: lobbyPasswords.lobbyId })
    .from(lobbyPasswords)
    .where(eq(lobbyPasswords.lobbyId, lobby.id))
    .limit(1);

  return { ...lobby, hasPassword: !!pw };
});
