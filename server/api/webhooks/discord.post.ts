import { ID, Query } from "node-appwrite";
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
  const signature = getHeader(event, "x-signature-ed25519") ?? "";
  const timestamp = getHeader(event, "x-signature-timestamp") ?? "";

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

  // Handle PING (type 1) — required for Discord endpoint verification
  if (body.type === 1) {
    return { type: 1 };
  }

  // Handle ENTITLEMENT_CREATE events
  if (body.type === 0 && body.event?.type === "ENTITLEMENT_CREATE") {
    const entitlement = body.event.data;
    const discordUserId: string | undefined = entitlement?.user_id;
    const skuId: string | undefined = entitlement?.sku_id;

    if (!discordUserId || !skuId) {
      setResponseStatus(event, 204);
      return "";
    }

    const { DB, DECORATIONS, USER_DECORATIONS } = getCollectionIds();
    const tables = getAdminTables();

    // Look up decoration by SKU ID
    const decorationResult = await tables.listRows({
      databaseId: DB,
      tableId: DECORATIONS,
      queries: [Query.equal("discordSkuId", skuId), Query.limit(1)],
    });

    if (decorationResult.total === 0) {
      console.warn(`[discord-webhook] Unknown SKU ID: ${skuId}`);
      setResponseStatus(event, 204);
      return "";
    }

    const decorationId: string = decorationResult.rows[0].decorationId;

    // Look up Appwrite user by Discord label
    const { users } = useAppwriteAdmin();
    const userResult = await users.list([
      Query.contains("labels", [`discord:${discordUserId}`]),
      Query.limit(1),
    ]);

    if (userResult.total === 0) {
      console.warn(
        `[discord-webhook] No Appwrite user for Discord ID: ${discordUserId}`,
      );
      setResponseStatus(event, 204);
      return "";
    }

    const userId: string = userResult.users[0].$id;

    // Grant the decoration — unique index handles idempotency
    try {
      await tables.createRow({
        databaseId: DB,
        tableId: USER_DECORATIONS,
        rowId: ID.unique(),
        data: {
          userId,
          decorationId,
          acquiredAt: new Date().toISOString(),
          source: "discord_purchase",
        },
      });
    } catch (err: any) {
      // Duplicate — user already owns it
      const isDuplicate =
        err?.code === 409 ||
        err?.type === "document_already_exists" ||
        String(err?.message).includes("already exists");
      if (!isDuplicate) {
        throw err;
      }
      console.info(
        `[discord-webhook] User ${userId} already owns ${decorationId}`,
      );
    }

    setResponseStatus(event, 204);
    return "";
  }

  // Unknown event type — acknowledge
  setResponseStatus(event, 204);
  return "";
});
