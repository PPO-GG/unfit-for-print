// A minimal y-websocket client over a real socket into the Worker, so tests
// exercise the same path a browser does: Worker routing, partyserver's
// accept, YServer's sync protocol, hibernation.
import { SELF } from "cloudflare:test";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

const MESSAGE_SYNC = 0;

export interface YTestClient {
  doc: Y.Doc;
  ws: WebSocket;
  /** Resolves once the server has answered our sync step 1. */
  synced: Promise<void>;
  /** Resolves with the close event when the server closes the socket. */
  closed: Promise<CloseEvent>;
  /** Every binary message received, raw. */
  received: Uint8Array[];
  close(): void;
}

export async function connectYClient(
  code: string,
  doc: Y.Doc = new Y.Doc(),
): Promise<YTestClient> {
  const res = await SELF.fetch(
    `https://sync.test/parties/lobby/${code}`,
    { headers: { Upgrade: "websocket" } },
  );
  const ws = res.webSocket;
  if (!ws) throw new Error(`WebSocket upgrade failed: ${res.status}`);
  // workerd defaults to "blob"; the sync protocol decoders need bytes.
  ws.binaryType = "arraybuffer";
  ws.accept();

  const received: Uint8Array[] = [];
  let resolveSynced!: () => void;
  const synced = new Promise<void>((resolve) => (resolveSynced = resolve));
  const closed = new Promise<CloseEvent>((resolve) =>
    ws.addEventListener("close", resolve),
  );

  ws.addEventListener("message", (event) => {
    if (typeof event.data === "string") return;
    const bytes = new Uint8Array(event.data as ArrayBuffer);
    received.push(bytes);
    const decoder = decoding.createDecoder(bytes);
    if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    const type = syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
    if (encoding.length(encoder) > 1) ws.send(encoding.toUint8Array(encoder));
    if (type === syncProtocol.messageYjsSyncStep2) resolveSynced();
  });

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === ws) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    ws.send(encoding.toUint8Array(encoder));
  });

  const step1 = encoding.createEncoder();
  encoding.writeVarUint(step1, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(step1, doc);
  ws.send(encoding.toUint8Array(step1));

  return {
    doc,
    ws,
    synced,
    closed,
    received,
    close: () => ws.close(1000, "test done"),
  };
}

/** Polls `probe` until it returns a truthy value or the timeout passes. */
export async function waitFor<T>(
  probe: () => T | Promise<T>,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
