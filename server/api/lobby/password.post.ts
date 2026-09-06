// server/api/lobby/password.post.ts
// Sets or clears a lobby's join password. Host only.
//
// The password used to live as plaintext in the Y.Doc settings map, which meant
// it was broadcast to every client in the lobby and could not be checked
// anywhere — the server has no access to the doc. It lives in Postgres now,
// hashed, and `join` is what enforces it.
//
// The doc still carries a `hasPassword` boolean so the UI can show the lock
// without holding the secret.

import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbyPasswords } from "~~/server/db/schema";
import { hashLobbyPassword } from "~~/server/utils/lobbyPassword";
import { requireHost } from "~~/server/utils/session";

/** Long enough to be worth typing, short enough not to be a passphrase field. */
const MAX_PASSWORD_LENGTH = 128;

export default defineEventHandler(async (event) => {
  const { lobbyId, password } = await readBody<{
    lobbyId?: string;
    password?: string | null;
  }>(event);

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }

  if (password != null && typeof password !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "password must be a string",
    });
  }

  if (typeof password === "string" && password.length > MAX_PASSWORD_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `password must be at most ${MAX_PASSWORD_LENGTH} characters`,
    });
  }

  await requireHost(event, lobbyId);
  const db = useDb();

  // Empty or absent clears the password — that is how the settings drawer
  // turns the toggle off, and it must not leave a stale hash behind.
  if (!password) {
    await db
      .delete(lobbyPasswords)
      .where(eq(lobbyPasswords.lobbyId, lobbyId));
    return { hasPassword: false };
  }

  const hash = await hashLobbyPassword(password);

  await db
    .insert(lobbyPasswords)
    .values({ lobbyId, hash })
    .onConflictDoUpdate({
      target: lobbyPasswords.lobbyId,
      set: { hash, updatedAt: new Date() },
    });

  return { hasPassword: true };
});
