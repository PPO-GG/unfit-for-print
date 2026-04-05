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

    // Look up Appwrite user by Discord ID — try OAuth identity first, then label fallback
    const { users } = useAppwriteAdmin();
    let userId: string | undefined;

    // Step 1: OAuth identity (web users — most common path)
    try {
      const identities = await users.listIdentities([
        Query.equal("providerUid", discordUserId),
        Query.equal("provider", "discord"),
        Query.limit(1),
      ]);
      if (identities.total > 0) {
        userId = identities.identities[0].userId;
      }
    } catch {
      // listIdentities may not be available in all Appwrite versions — fall through
    }

    // Step 2: Label fallback (Discord Activity users)
    if (!userId) {
      const labeled = await users.list([
        Query.contains("labels", [`discord:${discordUserId}`]),
        Query.limit(1),
      ]);
      if (labeled.total > 0) {
        userId = labeled.users[0].$id;
      }
    }

    if (!userId) {
      console.warn(`[discord-webhook] No Appwrite user for Discord ID: ${discordUserId}`);
      setResponseStatus(event, 204);
      return "";
    }

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
      const isDuplicate =
        err?.code === 409 ||
        err?.type === "document_already_exists" ||
        String(err?.message).includes("already exists");
      if (!isDuplicate) {
        throw err;
      }
      console.info(`[discord-webhook] User ${userId} already owns ${decorationId}`);
    }

    setResponseStatus(event, 204);
    return "";
  }

  // Unknown event type — acknowledge
  setResponseStatus(event, 204);
  return "";
});
