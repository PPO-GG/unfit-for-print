// server/api/chat/send.post.ts
// Server-side chat send endpoint.
// Validates the sender is in the lobby, applies rate limiting (500ms per user),
// sanitises text server-side, and writes the message via admin SDK.
//
// The client receives the message back through the existing Appwrite Realtime
// subscription, so the response only carries the $id for optimistic dedup.

import { ID, Query, Permission, Role } from "node-appwrite";

// ── In-memory rate-limit map (userId → last send timestamp) ──────────
// This is per-process; on a single Nitro instance it's fine.
// For multi-instance deployments you'd move this to Redis — but for now
// one process handles all requests so this is correct and zero-dependency.
const lastSendTimestamps = new Map<string, number>();
const RATE_LIMIT_MS = 500;

// ── Lightweight server-side sanitisation ─────────────────────────────
// Strip control chars and remove any HTML tags (no DOMPurify needed server-side
// since we store plain text, not markup).
function sanitiseText(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // strip control chars
    .replace(/<\/?[^>]+(>|$)/g, "") // strip HTML tags
    .trim();
}

const MAX_LENGTH = 255;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, userId, text } = body;

  // ── Validate inputs ────────────────────────────────────────────────
  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  }
  if (!text || typeof text !== "string") {
    throw createError({ statusCode: 400, statusMessage: "text is required" });
  }

  // ── Rate limit ─────────────────────────────────────────────────────
  const now = Date.now();
  const lastSend = lastSendTimestamps.get(userId) ?? 0;
  if (now - lastSend < RATE_LIMIT_MS) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too fast — please wait a moment",
    });
  }
  lastSendTimestamps.set(userId, now);

  // Housekeeping: prune stale entries every ~200 calls to prevent unbounded growth
  if (lastSendTimestamps.size > 5000) {
    const cutoff = now - 60_000; // entries older than 1 minute
    for (const [uid, ts] of lastSendTimestamps) {
      if (ts < cutoff) lastSendTimestamps.delete(uid);
    }
  }

  // ── Verify the user is in the lobby ────────────────────────────────
  await verifyPlayerInLobby(userId, lobbyId);

  // ── Sanitise + truncate ────────────────────────────────────────────
  const safeText = sanitiseText(text).substring(0, MAX_LENGTH);
  if (!safeText) {
    throw createError({
      statusCode: 400,
      statusMessage: "Message is empty after sanitisation",
    });
  }

  // ── Resolve sender name ────────────────────────────────────────────
  const { DB, PLAYER, GAMECHAT } = getCollectionIds();
  const databases = getAdminDatabases();

  const playerRes = await databases.listDocuments(DB, PLAYER, [
    Query.equal("userId", userId),
    Query.equal("lobbyId", lobbyId),
    Query.limit(1),
  ]);
  const senderName = playerRes.documents[0]?.name || "Anonymous";

  // ── Write message ──────────────────────────────────────────────────
  const docId = ID.unique();
  const doc = await databases.createDocument(
    DB,
    GAMECHAT,
    docId,
    {
      lobbyId,
      senderId: userId,
      senderName,
      text: safeText,
      timeStamp: new Date().toISOString(),
    },
    [
      Permission.read(Role.any()),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ],
  );

  return {
    success: true,
    messageId: doc.$id,
    senderName,
    sanitisedText: safeText,
  };
});
