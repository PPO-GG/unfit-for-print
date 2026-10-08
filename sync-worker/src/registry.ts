// The one cross-lobby view. Each LobbyRoom pushes a LobbyRecord here when
// its summary changes; the Worker answers /lobbies/summary, /status and the
// admin GC endpoints from this table. Stored in SQLite rather than memory so
// it survives this object being evicted.

import { DurableObject } from "cloudflare:workers";
import { getServerByName } from "partyserver";
import { codeFromDocId, docIdFor } from "./lobbyCode";
import { reportError } from "./reporter";
import {
  buildStatusBody,
  buildSummaryBody,
  planSweep,
  type StoredLobby,
  SWEEP_INTERVAL_MS,
} from "./registryViews";
import type { LobbyRecord } from "./types";

export function getRegistry(env: Env): DurableObjectStub<LobbyRegistry> {
  return env.REGISTRY.get(env.REGISTRY.idFromName("global"));
}

export class LobbyRegistry extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS lobbies (
           code TEXT PRIMARY KEY,
           record TEXT NOT NULL,
           updated_at INTEGER NOT NULL
         )`,
      );
      if ((await ctx.storage.getAlarm()) === null) {
        await ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
      }
    });
  }

  upsert(record: LobbyRecord, now: number = Date.now()): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO lobbies (code, record, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET record = excluded.record, updated_at = excluded.updated_at`,
      record.code,
      JSON.stringify(record),
      now,
    );
  }

  remove(code: string): void {
    this.ctx.storage.sql.exec(`DELETE FROM lobbies WHERE code = ?`, code);
  }

  has(code: string): boolean {
    return this.ctx.storage.sql.exec(`SELECT 1 FROM lobbies WHERE code = ?`, code).toArray().length > 0;
  }

  rows(): StoredLobby[] {
    return this.ctx.storage.sql
      .exec<{ record: string; updated_at: number }>(`SELECT record, updated_at FROM lobbies ORDER BY code`)
      .toArray()
      .map((row) => ({ record: JSON.parse(row.record) as LobbyRecord, updatedAt: row.updated_at }));
  }

  summaryBody(): string {
    return buildSummaryBody(this.rows().map((r) => r.record), Date.now());
  }

  statusBody(): string {
    return buildStatusBody(this.rows().map((r) => r.record), Date.now());
  }

  async gcAll(): Promise<{ flushed: number; remaining: number }> {
    const codes = this.rows().map((r) => r.record.code);
    const results = await Promise.allSettled(codes.map((code) => this.#purgeRoom(code)));
    let flushed = 0;
    for (const [i, result] of results.entries()) {
      const code = codes[i] as string;
      if (result.status === "fulfilled") {
        flushed++;
        // purge already removed the row; this keeps it idempotent.
        this.remove(code);
      } else {
        await reportError(this.env, result.reason);
      }
    }
    return { flushed, remaining: this.#clientCount() };
  }

  // The body is spelled out rather than Record<string, unknown>: workerd's RPC
  // types collapse `unknown` values to never, which erases the whole result.
  async gcOne(docId: string): Promise<
    | { status: 404; body: { error: string; docId: string } }
    | { status: 200; body: { removed: string; remaining: number } }
  > {
    const code = codeFromDocId(docId);
    if (!code || !this.has(code)) {
      return { status: 404, body: { error: "Document not found", docId } };
    }
    await this.#purgeRoom(code);
    this.remove(code);
    const remaining = this.#clientCount();
    return { status: 200, body: { removed: docIdFor(code), remaining } };
  }

  async alarm(): Promise<void> {
    try {
      const { remove, refresh } = planSweep(this.rows(), Date.now());
      for (const code of remove) this.remove(code);
      for (const code of refresh) {
        try {
          const room = await getServerByName(this.env.LOBBY, code);
          if (!(await room.refresh(code))) this.remove(code);
        } catch (err) {
          await reportError(this.env, err);
        }
      }
    } finally {
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
    }
  }

  #clientCount(): number {
    return this.rows().reduce((n, r) => n + r.record.clients, 0);
  }

  async #purgeRoom(code: string): Promise<void> {
    const room = await getServerByName(this.env.LOBBY, code);
    await room.purge(code);
  }
}
