import { describe, expect, it } from "vitest";
import { connectYClient } from "./helpers";

describe("LobbyRoom close handshake", () => {
  // A close with no status code reaches the room as 1005, which is reserved
  // and so never echoed back by partyserver: the client would sit in
  // CLOSING until the browser gave up, and y-websocket's disconnect() (no
  // code either) would leave the provider unable to reconnect meanwhile.
  it("answers a close with no status code with a 1000 close frame", async () => {
    const a = await connectYClient("CLOSE1");
    await a.synced;
    a.ws.close();
    const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 3000));
    const event = await Promise.race([a.closed, timeout]);
    expect(event).not.toBe("timeout");
    expect((event as CloseEvent).code).toBe(1000);
  });
});
