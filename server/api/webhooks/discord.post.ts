import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations, userDecorations, users } from "~~/server/db/schema";
import { verifyDiscordSignature } from "../../utils/discord-verify";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const publicKey = config.discordPublicKey as string;

  if (!publicKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Discord public key not configured",
    });
  }

  // Read raw body for signature verification
  const rawBody = await readRawBody(event);
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: "Empty request body" });
  }

  // Verify Discord signature
  const signature = getHeader(event, "x-signature-ed25519");
  const timestamp = getHeader(event, "x-signature-timestamp");

  if (!signature || !timestamp) {
    throw createError({ statusCode: 400, statusMessage: "Missing required signature headers" });
  }

  const isValid = await verifyDiscordSignature(
    rawBody,
    signature,
    timestamp,
    publicKey,
  );
  if (!isValid) {
    throw createError({ statusCode: 401, statusMessage: "Invalid signature" });
  }

  const body = JSON.parse(rawBody);

  // Handle PING — no event wrapper
  if (body.type === 1 && !body.event) {
    return { type: 1 };
  }

  // Handle ENTITLEMENT_CREATE events
  if (body.type === 1 && body.event?.type === "ENTITLEMENT_CREATE") {
    const entitlement = body.event.data;
    const discordUserId: string | undefined = entitlement?.user_id;
    const skuId: string | undefined = entitlement?.sku_id;

    if (!discordUserId || !skuId) {
      setResponseStatus(event, 204);
      return "";
    }

    const db = useDb();

    // Look up decoration by SKU ID
    const [decoration] = await db
      .select({ id: decorations.id })
      .from(decorations)
      .where(eq(decorations.discordSkuId, skuId))
      .limit(1);

    if (!decoration) {
      console.warn(`[discord-webhook] Unknown SKU ID: ${skuId}`);
      setResponseStatus(event, 204);
      return "";
    }

    const decorationId = decoration.id;

    // Look up the user by Discord ID — single source of truth for both
    // web (OAuth) and Activity users since Task 1/4/5/15's schema/auth work.
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.discordUserId, discordUserId))
      .limit(1);

    if (!user) {
      console.warn(`[discord-webhook] No user for Discord ID: ${discordUserId}`);
      setResponseStatus(event, 204);
      return "";
    }

    // Grant the decoration — composite PK (userId, decorationId) handles idempotency
    await db
      .insert(userDecorations)
      .values({
        userId: user.id,
        decorationId,
        source: "discord_purchase",
      })
      .onConflictDoNothing();

    setResponseStatus(event, 204);
    return "";
  }

  // Unknown event type — acknowledge
  setResponseStatus(event, 204);
  return "";
});
