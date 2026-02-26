// server/api/debug/diag.get.ts
// Temporary diagnostic endpoint to isolate CF Workers failures.
// Tests: 1) Admin SDK (Users), 2) TablesDB listRows, 3) Databases listDocuments
// TODO: Remove after debugging is complete.

import { Databases, Query } from "node-appwrite";

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const results: Record<string, any> = { timestamp: new Date().toISOString() };

  // ── Test 1: Can we create the admin client? ──────────────────────
  try {
    const admin = useAppwriteAdmin();
    results.adminClient = "OK";
  } catch (err: any) {
    results.adminClient = `FAIL: ${err.message}`;
  }

  // ── Test 2: TablesDB listRows (card packs — no auth needed) ─────
  try {
    const tables = getAdminTables();
    const res = await tables.listRows({
      databaseId: config.public.appwriteDatabaseId as string,
      tableId: config.public.appwriteLobbyCollectionId as string,
      queries: [Query.limit(1)],
    });
    results.tablesDB = `OK — ${res.total} total lobbies`;
  } catch (err: any) {
    results.tablesDB = `FAIL: ${err.message}`;
  }

  // ── Test 3: Traditional Databases.listDocuments ──────────────────
  try {
    const { databases } = useAppwriteAdmin();
    const res = await databases.listDocuments(
      config.public.appwriteDatabaseId as string,
      config.public.appwriteLobbyCollectionId as string,
      [Query.limit(1)],
    );
    results.databases = `OK — ${res.total} total lobbies`;
  } catch (err: any) {
    results.databases = `FAIL: ${err.message}`;
  }

  // ── Test 4: Reports collection specifically ─────────────────────
  try {
    const tables = getAdminTables();
    const res = await tables.listRows({
      databaseId: config.public.appwriteDatabaseId as string,
      tableId: config.public.appwriteReportsCollectionId as string,
      queries: [Query.limit(1)],
    });
    results.reportsTablesDB = `OK — ${res.total} total reports`;
  } catch (err: any) {
    results.reportsTablesDB = `FAIL: ${err.message}`;
  }

  // ── Test 5: Reports via traditional Databases ───────────────────
  try {
    const { databases } = useAppwriteAdmin();
    const res = await databases.listDocuments(
      config.public.appwriteDatabaseId as string,
      config.public.appwriteReportsCollectionId as string,
      [Query.limit(1)],
    );
    results.reportsDatabases = `OK — ${res.total} total reports`;
  } catch (err: any) {
    results.reportsDatabases = `FAIL: ${err.message}`;
  }

  // ── Test 6: Users API (admin SDK) ───────────────────────────────
  try {
    const { users } = useAppwriteAdmin();
    const list = await users.list([Query.limit(1)]);
    results.usersAPI = `OK — ${list.total} total users`;
  } catch (err: any) {
    results.usersAPI = `FAIL: ${err.message}`;
  }

  return results;
});
