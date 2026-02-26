// server/api/debug/diag.get.ts
// Temporary diagnostic endpoint to isolate CF Workers failures.
// TODO: Remove after debugging is complete.

import { Query } from "node-appwrite";

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const results: Record<string, any> = { timestamp: new Date().toISOString() };

  // ── Test 1: Can we create the admin client? ──────────────────────
  try {
    const admin = useAppwriteAdmin();
    results.adminClient = "OK";
  } catch (err: any) {
    results.adminClient = `FAIL: ${err.message}`;
    results.adminClientStack = err.stack;
  }

  // ── Test 2: Simple fetch to Appwrite (bypass SDK entirely) ───────
  try {
    const endpoint = config.public.appwriteEndpoint;
    const projectId = config.public.appwriteProjectId;
    const apiKey = (config as any).appwriteApiKey;
    const dbId = config.public.appwriteDatabaseId;
    const collectionId = config.public.appwriteLobbyCollectionId;

    const url = `${endpoint}/databases/${dbId}/collections/${collectionId}/documents?queries[]=${encodeURIComponent(JSON.stringify(["limit(1)"]))}`;
    const res = await fetch(url, {
      headers: {
        "X-Appwrite-Project": projectId as string,
        "X-Appwrite-Key": apiKey as string,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    results.rawFetch = `OK — status ${res.status}, total: ${(data as any).total}`;
  } catch (err: any) {
    results.rawFetch = `FAIL: ${err.message}`;
    results.rawFetchStack = err.stack;
  }

  // ── Test 3: TablesDB listRows ────────────────────────────────────
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
    results.tablesDBStack = err.stack;
  }

  // ── Test 4: Users API ────────────────────────────────────────────
  try {
    const { users } = useAppwriteAdmin();
    const list = await users.list([Query.limit(1)]);
    results.usersAPI = `OK — ${list.total} total users`;
  } catch (err: any) {
    results.usersAPI = `FAIL: ${err.message}`;
    results.usersAPIStack = err.stack;
  }

  return results;
});
