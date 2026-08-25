import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let _pool: Pool | null = null;
let _db: Database | null = null;

export function useDb(): Database {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("[db] DATABASE_URL is not set.");
    }
    _pool = new Pool({ connectionString, max: 10 });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}
