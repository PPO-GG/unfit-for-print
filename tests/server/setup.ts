// Hard guardrail: tests must never run against the real DATABASE_URL. The
// tests/server/db/*.test.ts suites unconditionally `db.delete(...)` real
// tables in beforeEach — on 2026-08-27 running them against the live dev
// database wiped users, lobbies, cards, decorations, submissions, and
// reports with no backup. TEST_DATABASE_URL must point at a disposable
// database (e.g. the local `unfit-postgres` Docker container documented in
// .env.example); DATABASE_URL is never touched by tests from this point on.
const realDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "[tests] TEST_DATABASE_URL is not set. Tests delete real table data and " +
      "must never run against DATABASE_URL. Point TEST_DATABASE_URL at a " +
      "disposable Postgres instance (see .env.example) before running tests.",
  );
}
if (realDatabaseUrl && testDatabaseUrl === realDatabaseUrl) {
  throw new Error(
    "[tests] TEST_DATABASE_URL is the same as DATABASE_URL. Tests delete " +
      "real table data — point TEST_DATABASE_URL at a separate, disposable " +
      "Postgres instance.",
  );
}
process.env.DATABASE_URL = testDatabaseUrl;

// Stub Nitro/H3 globals so server route modules can be imported in unit tests
// without a running Nitro server.

// @ts-ignore
globalThis.defineEventHandler = (fn: unknown) => fn;
// @ts-ignore
globalThis.createError = (opts: { statusCode: number; statusMessage: string }) => {
  const err = new Error(opts.statusMessage);
  (err as any).statusCode = opts.statusCode;
  return err;
};
// @ts-ignore
globalThis.readMultipartFormData = async () => [];
