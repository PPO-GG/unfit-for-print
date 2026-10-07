// One Durable Object per lobby code. Holds the lobby's Y.Doc and keeps a
// copy in DO storage, so a game survives deploys, restarts and hibernation.

import type { Connection } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

/** Storage key for the encoded doc: one value, overwritten on every save. */
export const DOC_KEY = "doc";

const WS_OPEN = 1;

export class LobbyRoom extends YServer {
  // Idle games cost nothing while sockets stay open. Safe only because the
  // doc is reloaded from storage (onLoad) every time the room wakes.
  static options = { hibernate: true };

  static callbackOptions = {
    debounceWait: 2000,
    debounceMaxWait: 10_000,
    timeout: 5000,
  };

  async onLoad(): Promise<void> {
    const stored = await this.ctx.storage.get<Uint8Array>(DOC_KEY);
    if (stored) Y.applyUpdate(this.document, stored);
  }

  async onSave(): Promise<void> {
    await this.ctx.storage.put(DOC_KEY, Y.encodeStateAsUpdate(this.document));
  }

  async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    super.onClose(connection, code, reason, wasClean);
    // The debounced save fires only on edits; flush now so the final state
    // is on disk before the room goes quiet.
    if (this.openConnectionCount(connection) === 0) await this.onSave();
  }

  /** Open sockets, not counting `excluding` (the one closing right now). */
  protected openConnectionCount(excluding?: Connection): number {
    let count = 0;
    for (const conn of this.getConnections()) {
      if (excluding && conn.id === excluding.id) continue;
      if (conn.readyState === WS_OPEN) count++;
    }
    return count;
  }
}
