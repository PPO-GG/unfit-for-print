// scripts/migrate-appwrite.ts
//
// One-shot migration: reads cards and Discord-linked users from the live
// Appwrite instance and writes them into Postgres via Drizzle.
//
// This is the only place `node-appwrite` is used in the whole project — it
// is a devDependency, run only via `pnpm migrate:appwrite`, and is never
// part of the app build.
import "dotenv/config";
import { Client, TablesDB, Query } from "node-appwrite";
import { useDb } from "../server/db/client";
import { whiteCards, blackCards, users } from "../server/db/schema";

const REQUIRED_ENV_VARS = {
  NUXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NUXT_PUBLIC_APPWRITE_ENDPOINT,
  NUXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID,
  NUXT_APPWRITE_API_KEY: process.env.NUXT_APPWRITE_API_KEY,
  NUXT_PUBLIC_APPWRITE_DATABASE_ID: process.env.NUXT_PUBLIC_APPWRITE_DATABASE_ID,
  NUXT_PUBLIC_APPWRITE_WHITE_CARD_COLLECTION_ID:
    process.env.NUXT_PUBLIC_APPWRITE_WHITE_CARD_COLLECTION_ID,
  NUXT_PUBLIC_APPWRITE_BLACK_CARD_COLLECTION_ID:
    process.env.NUXT_PUBLIC_APPWRITE_BLACK_CARD_COLLECTION_ID,
} satisfies Record<string, string | undefined>;

function assertRequiredEnvVars(vars: Record<string, string | undefined>): void {
  const missing = Object.entries(vars)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "See scripts/migrate-appwrite.ts for the full list and Step 4 of the migration brief for how to set them.",
    );
  }
}

assertRequiredEnvVars(REQUIRED_ENV_VARS);

const APPWRITE_ENDPOINT = REQUIRED_ENV_VARS.NUXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = REQUIRED_ENV_VARS.NUXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = REQUIRED_ENV_VARS.NUXT_APPWRITE_API_KEY!;
const APPWRITE_DB_ID = REQUIRED_ENV_VARS.NUXT_PUBLIC_APPWRITE_DATABASE_ID!;
const WHITE_COLLECTION = REQUIRED_ENV_VARS.NUXT_PUBLIC_APPWRITE_WHITE_CARD_COLLECTION_ID!;
const BLACK_COLLECTION = REQUIRED_ENV_VARS.NUXT_PUBLIC_APPWRITE_BLACK_CARD_COLLECTION_ID!;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const tablesDb = new TablesDB(client);
const db = useDb();

async function fetchAllDocuments(databaseId: string, tableId: string) {
  const all: any[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await tablesDb.listRows({ databaseId, tableId, queries });
    all.push(...page.rows);
    if (page.rows.length < 100) break;
    cursor = page.rows[page.rows.length - 1].$id;
  }
  return all;
}

async function migrateCards() {
  console.log("Migrating white cards...");
  const whiteDocs = await fetchAllDocuments(APPWRITE_DB_ID, WHITE_COLLECTION);
  if (whiteDocs.length > 0) {
    await db.insert(whiteCards).values(
      whiteDocs.map((d) => ({
        text: d.text,
        pack: d.pack ?? null,
        active: d.active ?? true,
        timesPlayed: d.timesPlayed ?? 0,
        timesWon: d.timesWon ?? 0,
      })),
    );
  }
  console.log(`  ${whiteDocs.length} white cards migrated.`);

  console.log("Migrating black cards...");
  const blackDocs = await fetchAllDocuments(APPWRITE_DB_ID, BLACK_COLLECTION);
  if (blackDocs.length > 0) {
    await db.insert(blackCards).values(
      blackDocs.map((d) => ({
        text: d.text,
        pack: d.pack ?? null,
        active: d.active ?? true,
        pick: d.pick ?? 1,
        timesPlayed: d.timesPlayed ?? 0,
      })),
    );
  }
  console.log(`  ${blackDocs.length} black cards migrated.`);
}

async function migrateUsers() {
  console.log("Migrating users (discordUserId linkage only)...");
  const { Users } = await import("node-appwrite");
  const usersApi = new Users(client);

  let cursor: string | undefined;
  let migrated = 0;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await usersApi.list({ queries });
    if (page.users.length === 0) break;

    for (const u of page.users) {
      const discordUserId = (u.prefs as any)?.discordUserId as string | undefined;
      if (!discordUserId) continue; // guests / non-Discord accounts are not migrated

      await db
        .insert(users)
        .values({
          discordUserId,
          name: u.name || "Unknown",
          avatarUrl: (u.prefs as any)?.avatarUrl ?? null,
          isGuest: false,
          isAdmin: u.labels?.includes("admin") ?? false,
        })
        .onConflictDoNothing({ target: users.discordUserId });
      migrated++;
    }

    if (page.users.length < 100) break;
    cursor = page.users[page.users.length - 1].$id;
  }
  console.log(`  ${migrated} Discord-linked users migrated.`);
}

async function main() {
  await migrateCards();
  await migrateUsers();
  console.log("Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
