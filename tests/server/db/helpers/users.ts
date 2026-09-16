// Reset helper for suites that need an empty `users` table.
//
// `db.delete(users)` fails with a foreign-key violation while anything still
// references a user, and lobbies, players, submissions and reports all do,
// without ON DELETE CASCADE. A suite that deleted only `users` in beforeEach
// therefore depended on every suite that ran before it having cleaned up its
// lobbies — and lobby-capacity and lobby-password did not, so whichever suite
// the scheduler put next failed every test (decorations on one run, the admin
// card suites on another).
//
// TRUNCATE ... CASCADE empties `users` and every table that references it,
// however the previous suite left them. Card, pack, decoration and issue
// tables do not reference `users`, so they are untouched.
import { sql } from "drizzle-orm";
import { useDb } from "~/server/db/client";

export async function resetUserTables() {
  await useDb().execute(sql`TRUNCATE TABLE "users" CASCADE`);
}
